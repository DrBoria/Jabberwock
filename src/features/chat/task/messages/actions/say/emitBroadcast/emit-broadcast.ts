import type { NotificationSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@jabberwock/types"
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { emitNonPartialMessage, emitPartialMessage, emitCompleteMessage } from "./broadcast-message-handlers"

/**
 * Checkpoint data for tool execution checkpoint/restore.
 * Contains dynamic key-value pairs representing the tool's execution state
 * at the time of checkpoint creation.
 */
export type CheckpointData = { [key: string]: unknown }

export async function emitBroadcast(
	taskId: string,
	broadcastType: string,
	type: NotificationSay,
	text?: string,
	images?: string[],
	partial?: boolean,
	checkpoint?: CheckpointData,
	progressStatus?: ToolProgressStatus,
	options: {
		isNonInteractive?: boolean
	} = {},
	contextCondense?: ContextCondense,
	contextTruncation?: ContextTruncation,
): Promise<undefined> {
	const task = getTask(taskId)

	await task.taskModeReady

	if (task._state.abort) {
		throw new Error(`[Jabberwock#say] task ${task.taskId}.${task.instanceId} aborted`)
	}

	const partialMsg = task._partialMessage
	const isUpdatingPreviousPartial = partialMsg !== undefined && partialMsg.say === type
	const mode = task._state._taskMode ?? "code"

	if (partial === undefined) {
		emitNonPartialMessage(
			task,
			taskId,
			broadcastType,
			type,
			mode,
			text,
			images,
			checkpoint,
			options,
			contextCondense,
			contextTruncation,
		)

		return
	}

	if (partial) {
		emitPartialMessage(
			task,
			taskId,
			broadcastType,
			type,
			mode,
			text,
			images,
			partial,
			progressStatus,
			isUpdatingPreviousPartial,
			options,
			contextCondense,
			contextTruncation,
		)

		return
	}

	emitCompleteMessage(
		task,
		taskId,
		broadcastType,
		type,
		mode,
		text,
		images,
		progressStatus,
		isUpdatingPreviousPartial,
		options,
		contextCondense,
		contextTruncation,
	)
}
