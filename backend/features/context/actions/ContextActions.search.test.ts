import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { contextEventNames } from "@jabberwock/types"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
	closeAndResetContextArchive,
	getContextDatabase,
	ingestTaskMessages,
	initContextArchive,
} from "@features/context/services/ContextArchiveService"
import { describeNode, getTaskStats, searchArchivedContext } from "@features/context/services/ContextSearchService"
import { recallRange } from "@features/context/services/ContextRecallService"

// ICG-C2 read-path acceptance (search / recall / describe / task stats) over a temp archive (section 6.4 verbatim recall including thinking blocks). Split out of ContextActions.test.ts so the suite stays within its line budget [D-actions-test-split].

describe("context search service over a temp archive", () => {
	let storageDir: string

	beforeEach(async () => {
		storageDir = await mkdtemp(path.join(os.tmpdir(), "icg-c2-search-"))
		await initContextArchive(storageDir)
	})

	afterEach(async () => {
		await closeAndResetContextArchive() // awaiting a possibly-sync reset is safe in both worlds.
		await rm(storageDir, { recursive: true, force: true })
	})

	const marker = (seq: number): string => `CTXMKR${String(seq).padStart(6, "0")}` // single alphanumeric token - unicode61 tokenizer safe [C1 FTS convention].

	it("searchArchivedContext finds exact marker rows and honors roleFilter", () => {
		const messages = [
			{ role: "user", content: `please find ${marker(482)}` },
			{ role: "assistant", content: `the answer is near ${marker(483)} ok` },
			{ role: "tool", content: `tool output mentions ${marker(484)}` },
			{ role: "user", content: `follow up about ${marker(485)}` },
		]
		expect(ingestTaskMessages("task-x", messages).totalArchived).toBe(4)

		const hits = searchArchivedContext({
			type: contextEventNames.searchRequested,
			query: marker(483),
			taskId: "task-x",
		})
		expect(hits.length).toBe(1) // the FTS marker is unique to one row.
		expect(hits[0].kind).toBe("message")
		expect(hits[0].nodeId).toMatch(/^msg:task-x:\d+$/) // msg:<taskId>:<seq> addressing for recall locators.

		const toolOnly = searchArchivedContext({
			type: contextEventNames.searchRequested,
			query: marker(484),
			taskId: "task-x",
			roleFilter: ["tool"],
		})
		expect(toolOnly.length).toBe(1) // matching role keeps the hit.

		const wrongRole = searchArchivedContext({
			type: contextEventNames.searchRequested,
			query: marker(482),
			taskId: "task-x",
			roleFilter: ["assistant"],
		})
		expect(wrongRole.length).toBe(0) // non-matching role filter drops the hit entirely [D-rolefilter-unknown-dropped].
	})

	it("recallRange returns verbatim partsJson including thinking blocks (section 6.4 byte-for-byte parity)", () => {
		const thinkingText = `reasoning trace CTXMKR000917 before the answer`
		expect(
			ingestTaskMessages("task-think", [
				{
					role: "assistant",
					content: [
						{ type: "thinking", text: thinkingText },
						{ type: "text", text: `final answer near ${marker(918)}` },
					],
				},
			]).totalArchived,
		).toBe(1)

		const found = searchArchivedContext({
			type: contextEventNames.searchRequested,
			query: marker(918),
			taskId: "task-think",
		})
		expect(found.length).toBe(1)

		const recall = recallRange({ type: contextEventNames.recallRequested, nodeId: found[0].nodeId })
		expect(recall.items.length).toBe(1)
		expect(recall.items[0].role).toBe("assistant") // normalizeRole preserves in-domain roles verbatim.
		expect(recall.items[0].partsJson).toContain(thinkingText) // thinking block survives recall untouched [section 6.4].
	})

	it("recallRange preserves stored content byte-for-byte (no re-serialization drift)", () => {
		const parts = [
			{ type: "thinking", text: `deep thought CTXMKR001523` },
			{ type: "text", text: `answer ${marker(1524)}` },
		]
		expect(ingestTaskMessages("task-verbatim", [{ role: "assistant", content: parts }]).totalArchived).toBe(1)

		const found = searchArchivedContext({
			type: contextEventNames.searchRequested,
			query: marker(1524),
			taskId: "task-verbatim",
		})
		expect(found.length).toBe(1)

		const recall = recallRange({ type: contextEventNames.recallRequested, nodeId: found[0].nodeId })
		expect(recall.items[0]?.partsJson).toBe(JSON.stringify(parts)) // the archive is append-only and never rewrites stored rows [section 6.4].
	})

	it("recallRange rejects unresolved locators with an empty response (no throw) [D-recall-locators-required]", () => {
		const bare = recallRange({ type: contextEventNames.recallRequested, fromSeq: 1, toSeq: 5 }) // no nodeId anchor - the protocol has no taskId field on RecallRequest.
		expect(bare.items).toEqual([])
		expect(bare.truncatedFromMiddle).toBe(false)

		const missing = recallRange({ type: contextEventNames.recallRequested, nodeId: "msg:no-such-task:9" }) // locator for a task that was never archived.
		expect(missing.items).toEqual([])
	})

	it("describeNode falls back to the leaf shape while C1 rollups are absent (context_nodes empty in ICG-C2)", () => {
		expect(ingestTaskMessages("task-desc", [{ role: "user", content: `hello ${marker(700)}` }]).totalArchived).toBe(
			1,
		)

		const db = getContextDatabase()
		if (db === null) throw new Error("archive not initialized in test") // narrowing without assertion operators.
		const stats = getTaskStats(db, "task-desc")
		if (stats === null) throw new Error("no task stats for the describe fixture")

		expect(stats.totalCount).toBe(1)
		const described = describeNode({
			type: contextEventNames.describeRequested,
			taskId: "task-desc",
			fromSeq: stats.minSeq,
			toSeq: stats.maxSeq,
		})
		expect(described.nodeId).toBe(`msg:task-desc:${stats.minSeq}`) // leaf fallback addressing [D-describe-leaf-fallback].
		expect(described.depth).toBe(0)
		expect(described.descendantCount).toBe(1)
		expect(described.summaryText).toBeNull() // null = "propose recall" per section 6.2 - rollup summaries land with the compressor phase (C1: no rollup nodes yet).
	})

	it("getTaskStats reports task-wide bounds for chunked delivery termination", () => {
		const messages = [0, 1, 2].map((i) => ({
			role: i % 2 === 0 ? "user" : "assistant",
			content: `row ${marker(300 + i)}`,
		}))
		expect(ingestTaskMessages("task-stats", messages).totalArchived).toBe(3)

		const db = getContextDatabase()
		if (db === null) throw new Error("archive not initialized in test")
		const stats = getTaskStats(db, "task-stats")
		if (stats === null) throw new Error("no task stats for the ingested fixture")

		expect(stats.totalCount).toBe(3) // [D-history-page-termination] drives the delivery loop bound.
		expect(stats.maxSeq - stats.minSeq + 1).toBe(3) // contiguous span over a fresh ingest.
	})
})
