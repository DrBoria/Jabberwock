import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { contextEventNames, type ClientTarget } from "@jabberwock/types"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
	closeAndResetContextArchive,
	getContextDatabase,
	ingestTaskMessages,
	initContextArchive,
} from "@features/context/services/ContextArchiveService"
import { getTaskStats } from "@features/context/services/ContextSearchService"
import { runHistoryRangeDelivery } from "./index"

// ICG-C2 chunked history-range delivery acceptance: page-by-page delivery with terminal boundaries, single-sender cancellation acks, and undeliverable-target stops [D-cancel-ack-requires-sender-id]. Split out of ContextActions.test.ts so the suite stays within its line budget [D-actions-test-split].

interface CapturedFrame {
	message: Record<string, unknown>
	target?: ClientTarget
} // local capture shape mirroring ProviderHandle.postMessageToWebview - keeps the delivery-loop tests cast-free.

function makeCapturingProvider(frames: CapturedFrame[], storageDirPath: string) {
	return {
		postMessageToWebview: async (message: Record<string, unknown>, target?: ClientTarget): Promise<boolean> => {
			frames.push({ message, target })
			return true
		}, // structurally satisfies ProviderHandle at the call site - no cast needed.
		context: { globalStorageUri: { fsPath: storageDirPath } },
	}
}

describe("runHistoryRangeDelivery chunking and cancellation", () => {
	let storageDir: string

	beforeEach(async () => {
		storageDir = await mkdtemp(path.join(os.tmpdir(), "icg-c2-delivery-"))
		await initContextArchive(storageDir)
	})

	afterEach(async () => {
		await closeAndResetContextArchive()
		await rm(storageDir, { recursive: true, force: true })
	})

	it("delivers every row in pages and ends with a completed frame carrying window boundaries", async () => {
		const messages = Array.from({ length: 25 }, (_, i) => ({
			role: "user",
			content: `delivery row ${String(100 + i).padStart(6, "0")}`,
		})) // plain numeric tokens - no FTS lookup needed here.
		expect(ingestTaskMessages("task-deliver", messages).totalArchived).toBe(25)

		const db = getContextDatabase()
		if (db === null) throw new Error("archive not initialized in test")
		const stats = getTaskStats(db, "task-deliver")
		if (stats === null) throw new Error("no task stats for the delivery fixture")

		const frames: CapturedFrame[] = []
		const provider = makeCapturingProvider(frames, storageDir)
		const requester: ClientTarget = { kind: "client", clientId: "client-a" } // fresh literal - assignable to the union member without a cast.

		const result = await runHistoryRangeDelivery({
			request: {
				type: contextEventNames.historyRangeRequested,
				taskId: "task-deliver",
				requestId: "req-full-1",
				fromSeq: stats.minSeq,
				toSeq: stats.maxSeq,
				pageSize: 7,
			}, // 25 rows / page size 7 = four chunks.
			provider,
			target: requester,
		})

		expect(result).toEqual({ completed: true, cancelled: false })
		expect(frames.length).toBe(5) // four chunk frames + one completed frame [D-history-page-termination].
		for (const frame of frames) {
			expect(frame.target).toEqual(requester) // every frame is targeted at the requesting client [D-response-targeting] - no broadcast leakage.
		}

		const last = frames[frames.length - 1]?.message ?? {}
		expect(last["type"]).toBe("context.history.completed")
		expect(last["totalCount"]).toBe(25) // stats.totalCount rides on the terminal frame.
		expect(last["minSeq"]).toBe(stats.minSeq) // delivered page boundaries per section 6.2.
		expect(last["maxSeq"]).toBe(stats.maxSeq)
	})

	it("sends exactly one cancel ack to the requesting client and stops mid-recall [D-cancel-ack-requires-sender-id]", async () => {
		const messages = Array.from({ length: 20 }, (_, i) => ({
			role: "user",
			content: `cancel row ${String(500 + i).padStart(6, "0")}`,
		}))
		expect(ingestTaskMessages("task-cancel", messages).totalArchived).toBe(20)

		const db = getContextDatabase()
		if (db === null) throw new Error("archive not initialized in test")
		const stats = getTaskStats(db, "task-cancel")
		if (stats === null) throw new Error("no task stats for the cancel fixture")

		let probeCalls = 0 // mirrors handleTaskCancelObserver's single-sender rule: only the delivery loop reacts to the flag.
		const frames: CapturedFrame[] = []
		const provider = makeCapturingProvider(frames, storageDir)
		const requester: ClientTarget = { kind: "client", clientId: "client-a" }

		const run = runHistoryRangeDelivery({
			request: {
				type: contextEventNames.historyRangeRequested,
				taskId: "task-cancel",
				requestId: "req-cancel-1",
				fromSeq: stats.minSeq,
				toSeq: stats.maxSeq,
				pageSize: 5,
			}, // four pages of five rows.
			provider,
			target: requester,
			isCancelled: () => {
				probeCalls += 1
				return probeCalls >= 3
			}, // flips after the third chunk - mid-recall cancellation (spec line 350).
		})

		const result = await run
		expect(result).toEqual({ completed: false, cancelled: true })

		const types = frames.map((frame) => frame.message["type"])
		expect(types.filter((t) => t === "context.history.chunk")).toHaveLength(3) // three chunks delivered before the flip.
		const acks = frames.filter((f) => f.message["type"] === contextEventNames.historyCancelled)
		expect(acks.length).toBe(1) // exactly one cancel frame - single sender rule [D-history-cancel-between-chunks].

		for (const frame of frames) {
			expect(frame.target).toEqual(requester) // the ack goes to the requesting client ONLY; observers never receive it.
		}
	})

	it("stops without an ack when no target is available and reports undeliverable [D-stop-on-undeliverable]", async () => {
		const messages = Array.from({ length: 6 }, (_, i) => ({
			role: "user",
			content: `dead row ${String(900 + i).padStart(6, "0")}`,
		}))
		expect(ingestTaskMessages("task-dead", messages).totalArchived).toBe(6)

		const db = getContextDatabase()
		if (db === null) throw new Error("archive not initialized in test")
		const stats = getTaskStats(db, "task-dead")
		if (stats === null) throw new Error("no task stats for the dead-target fixture")

		const provider = {
			// a client that is already gone: every send fails.
			postMessageToWebview: async (): Promise<boolean> => false,
			context: { globalStorageUri: { fsPath: storageDir } },
		}

		const result = await runHistoryRangeDelivery({
			request: {
				type: contextEventNames.historyRangeRequested,
				taskId: "task-dead",
				requestId: "req-dead-1",
				fromSeq: stats.minSeq,
				toSeq: stats.maxSeq,
				pageSize: 2,
			}, // no target at all - the first failed send is terminal.
			provider,
		})

		expect(result).toEqual({ completed: false, cancelled: true })
	})
})
