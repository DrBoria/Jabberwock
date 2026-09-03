import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GlobalFileNames } from "@shared/globalFileNames"

import {
	archiveQueryForTests,
	closeAndResetContextArchive,
	getContextWindowMeta,
	initContextArchive,
	ingestTaskMessages,
} from "./ContextArchiveService"

/** One deterministic fixture message; shape mirrors the persisted API history entries (role + content [+ ts]). */
function buildFixtureMessage(index: number): { role: string; content: unknown; ts?: number } {
	const roles = ["user", "assistant", "tool", "system"] as const
	const role = roles[index % 4]
	if (role === "assistant") {
		return { role, content: [{ type: "text" as const, text: `assistant reply ${index} with supporting detail` }] }
	}
	return { role, content: `message body ${index}`, ts: 1_700_000_000_000 + index * 60_000 }
}

function buildFixtureMessages(count: number): Array<{ role: string; content: unknown; ts?: number }> {
	const out = [] as Array<{ role: string; content: unknown; ts?: number }>
	for (let i = 0; i < count; i += 1) out.push(buildFixtureMessage(i))
	return out
}

/** Long deterministic thinking text (~64 KB, unique per seed) for the section 4.4 expansion-invariant fixture. */
function buildLongThinkingText(seed: number): string {
	const parts = [] as string[]
	let i = 0
	while (parts.join(" ").length < 65_000) {
		parts.push(
			`step ${i} of seed-${seed}: weigh hypothesis h${(i * 7 + seed) % 97} against constraint c${(i * 13 + seed) % 89}, note tradeoff t${(i * 29 + seed) % 53}`,
		)
		i += 1
	}
	return parts.join(" ")
}

let tmpDir = ""

beforeEach(async () => {
	tmpDir = await mkdtemp(path.join(os.tmpdir(), "icg-c1-"))
})

afterEach(async () => {
	closeAndResetContextArchive()
	await rm(tmpDir, { recursive: true, force: true })
})

describe("context archive service (ICG-C1 acceptance)", () => {
	it("archive driver is available in this runtime (better-sqlite3 resolvable; G7 canary)", async () => {
		const report = await initContextArchive(tmpDir)
		expect(report.discrepancies).toEqual([])
		const probe = ingestTaskMessages("__probe__", [{ role: "user", content: "driver availability probe" }])
		// A zero here would mean the native driver failed to load and every archive op silently degraded.
		expect(probe.totalArchived).toBe(1)
	})

	it("A1: zero-loss N-message ingest with idempotent re-ingest, tail append and P1 lossy-overwrite guard", async () => {
		const report = await initContextArchive(tmpDir)
		expect(report.tasksScanned).toBe(0) // no tasks dir yet - clean start

		const messages = buildFixtureMessages(57)
		const first = ingestTaskMessages("task-a", messages)
		expect(first.ingested).toBe(57)
		expect(first.totalArchived).toBe(57)

		// Idempotent re-ingest of the same history (section 4.3 spirit / section 5.6 dual-write): nothing new lands.
		const second = ingestTaskMessages("task-a", messages)
		expect(second.ingested).toBe(0)
		expect(second.totalArchived).toBe(57)

		// Dual-write tail append: the save flow persists one more finalized message on top of the archived prefix.
		const extended = [...messages, buildFixtureMessage(57)]
		const third = ingestTaskMessages("task-a", extended)
		expect(third.ingested).toBe(1)
		expect(third.totalArchived).toBe(58)

		// P1 append-only: a shrunken history below the archived prefix leaves the archive untouched (lossy overwrite branch).
		const lossy = ingestTaskMessages("task-a", messages.slice(0, 30))
		expect(lossy.ingested).toBe(0)
		expect(lossy.totalArchived).toBe(58)

		const rows = archiveQueryForTests<{ n: number; minSeq: number; maxSeq: number }>(
			"SELECT COUNT(*) AS n, COALESCE(MIN(seq), 0) AS minSeq, COALESCE(MAX(seq), 0) AS maxSeq FROM context_messages WHERE task_id = ?",
			["task-a"],
		)
		expect(rows[0]).toEqual({ n: 58, minSeq: 1, maxSeq: 58 }) // contiguous seqs from 1 - zero loss across all branches above
	})

	it("A2: reconciliation on start imports the gap left by a crash between JSON write and archive ingest", async () => {
		const firstReport = await initContextArchive(tmpDir)
		expect(firstReport.tasksScanned).toBe(0) // tasks dir does not exist yet - ENOENT is skipped silently

		const all = buildFixtureMessages(7)
		// The dual-write caught up to the first 3 messages, then a crash hit before the tail was ingested.
		expect(ingestTaskMessages("task-b", all.slice(0, 3)).totalArchived).toBe(3)

		const taskDir = path.join(tmpDir, "tasks", "task-b")
		await mkdir(taskDir, { recursive: true })
		// The JSON ground truth already holds ALL 7 messages (saveApiMessages wrote them before the crash).
		await writeFile(path.join(taskDir, GlobalFileNames.apiConversationHistory), JSON.stringify(all))

		closeAndResetContextArchive() // simulate process death + restart on the same storage dir
		const report = await initContextArchive(tmpDir)
		expect(report.tasksScanned).toBe(1)
		expect(report.reconciledTasks).toBe(1)
		expect(report.discrepancies).toEqual([])

		const rows = archiveQueryForTests<{ n: number; minSeq: number; maxSeq: number }>(
			"SELECT COUNT(*) AS n, COALESCE(MIN(seq), 0) AS minSeq, COALESCE(MAX(seq), 0) AS maxSeq FROM context_messages WHERE task_id = ?",
			["task-b"],
		)
		expect(rows[0]).toEqual({ n: 7, minSeq: 1, maxSeq: 7 }) // gap seqs 4..7 imported by range on restart

		const meta = getContextWindowMeta()["task-b"]
		expect(meta).toEqual({ totalSeqCount: 7, freshTailFromSeq: 1 })
	})

	it("A3: FTS MATCH returns the row whose thinking text contains the query token (Q3 include)", async () => {
		await initContextArchive(tmpDir)
		const marker = "ZEBRAQUARTZ9281" // single alphanumeric token - safe for the default unicode61 tokenizer

		const messages: Array<{ role: string; content: unknown }> = [
			{
				role: "assistant",
				content: [
					{
						type: "thinking" as const,
						thinking: `internal reasoning before answering ${marker} then committing to the plan`,
					},
					{ type: "text" as const, text: "final answer without the marker" },
				],
			},
			{ role: "user", content: "plain string message with no searchable token here" },
			{
				role: "assistant",
				content: [
					{ type: "tool_use" as const, id: "tu_1", name: "read_file", input: { path: "/tmp/example.txt" } },
				],
			},
		]

		expect(ingestTaskMessages("task-c", messages).totalArchived).toBe(3) // all three shapes stored (zero loss at ingest level too)

		const rows = archiveQueryForTests<{ rowid: number }>(
			"SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?",
			[marker],
		)
		expect(rows.length).toBe(1) // only the thinking-bearing message contains it - Q3 default include works end to end

		// The matched FTS entry maps back onto a context_messages row whose verbatim content_json carries the thinking text.
		const cm = archiveQueryForTests<{ seq: number; content_json: string }>(
			"SELECT seq, content_json FROM context_messages WHERE task_id = ? AND seq = ?",
			["task-c", 1],
		)
		expect(cm[0].content_json).toContain(marker)

		// FTS5 parses unquoted MATCH strings as query syntax (hyphens act as operators), so the negative control must be a double-quoted phrase.
		const absent = archiveQueryForTests<{ rowid: number }>(
			"SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?",
			['"NOPE-ABSENT-TOKEN"'],
		)
		expect(absent.length).toBe(0) // negative control - no phantom matches
	})

	it("A4: section 4.4 expansion invariant - stored content_json is byte-for-byte the original parts (long-thinking fixture)", async () => {
		await initContextArchive(tmpDir)
		const longThinking = buildLongThinkingText(42)

		const messages: Array<{ role: string; content: unknown }> = [
			buildFixtureMessage(0), // plain string content with ts metadata
			buildFixtureMessage(1), // assistant text-block array
			{
				role: "assistant",
				content: [
					{ type: "thinking" as const, thinking: longThinking },
					{ type: "text" as const, text: "answer after a very long reasoning pass" },
				],
			},
			buildFixtureMessage(3), // system string content with ts metadata
			{
				role: "tool",
				content: [
					{
						type: "tool_result" as const,
						tool_use_id: "tu_1",
						content: [{ type: "text" as const, text: "file contents here" }],
					},
				],
			},
		]

		expect(ingestTaskMessages("task-d", messages).totalArchived).toBe(5)

		for (let i = 0; i < messages.length; i += 1) {
			const rows = archiveQueryForTests<{ content_json: string }>(
				"SELECT content_json FROM context_messages WHERE task_id = ? AND seq = ?",
				["task-d", i + 1],
			)
			expect(rows).toHaveLength(1)
			// Byte-for-byte parity through SQLite TEXT: no re-serialization, mutation or truncation at any layer.
			expect(rows[0].content_json).toBe(JSON.stringify(messages[i].content))
		}

		// Explicit thinking-text equality on the long fixture (the S3 lossless guarantee for reasoning content).
		const stored = JSON.parse(
			archiveQueryForTests<{ content_json: string }>(
				"SELECT content_json FROM context_messages WHERE task_id = ? AND seq = ?",
				["task-d", 3],
			)[0].content_json,
		) as Array<Record<string, unknown>>
		const thinkingBlock = stored.find((block) => block.type === "thinking")
		expect(thinkingBlock?.thinking).toBe(longThinking)
	})
})
