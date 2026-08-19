import type { ITaskModel } from "@features/chat/task/store"
import {
	collectRemovedContextEventIds,
	truncateClineMessages,
	truncateApiHistoryWithCleanup,
} from "./messageManager.history"
import type { RewindOptions } from "./messageManager.history"

export async function rewindToTimestamp(task: ITaskModel, ts: number, options: RewindOptions = {}): Promise<void> {
	const { includeTargetMessage = false, skipCleanup = false } = options

	const msgIndex = task.messages.findIndex((m) => m.ts === ts)
	if (msgIndex === -1) {
		throw new Error(`Message with timestamp ${ts} not found in messages`)
	}

	const cutoffIndex = includeTargetMessage ? msgIndex + 1 : msgIndex

	await performRewind(task, cutoffIndex, ts, { skipCleanup })
}

export async function rewindToIndex(task: ITaskModel, toIndex: number, options: RewindOptions = {}): Promise<void> {
	const cutoffTs = task.messages[toIndex]?.ts ?? Date.now()
	await performRewind(task, toIndex, cutoffTs, options)
}

async function performRewind(
	task: ITaskModel,
	toIndex: number,
	cutoffTs: number,
	options: RewindOptions,
): Promise<void> {
	const { skipCleanup = false } = options

	const removedIds = collectRemovedContextEventIds(task, toIndex)

	await truncateClineMessages(task.taskId, task.messages.slice(0, toIndex))

	await truncateApiHistoryWithCleanup(task, cutoffTs, removedIds, skipCleanup)
}
