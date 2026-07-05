import type { NotificationSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@jabberwock/types"
import type { CheckpointData } from "./emit-broadcast"
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { emitMessageCreate, emitMessageUpdate } from "./broadcast-message-emitters"

type TaskType = ReturnType<typeof getTask>

export function emitNonPartialMessage(
	task: TaskType,
	taskId: string,
	broadcastType: string,
	type: NotificationSay,
	mode: string,
	text?: string,
	images?: string[],
	checkpoint?: CheckpointData,
	options: { isNonInteractive?: boolean } = {},
	contextCondense?: ContextCondense,
	contextTruncation?: ContextTruncation,
): void {
	const sayTs = task.generateUniqueTs()

	if (!options.isNonInteractive) {
		task.setLastMessageTs(sayTs)
	}

	emitMessageCreate(taskId, broadcastType, {
		mode,
		ts: sayTs,
		type: "say",
		say: type,
		text,
		images,
		checkpoint,
		contextCondense,
		contextTruncation,
	})
}

export function emitPartialMessage(
	task: TaskType,
	taskId: string,
	broadcastType: string,
	type: NotificationSay,
	mode: string,
	text?: string,
	images?: string[],
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isUpdatingPreviousPartial?: boolean,
	options: { isNonInteractive?: boolean } = {},
	contextCondense?: ContextCondense,
	contextTruncation?: ContextTruncation,
): void {
	if (isUpdatingPreviousPartial) {
		emitMessageUpdate(task.taskId, broadcastType, {
			mode,
			ts: task._partialMessage!.ts,
			type: "say",
			say: type,
			text,
			images,
			partial,
			progressStatus,
			contextCondense,
			contextTruncation,
		})
	} else {
		const sayTs = task.generateUniqueTs()

		task.setPartialMessage(sayTs, type)

		if (!options.isNonInteractive) {
			task.setLastMessageTs(sayTs)
		}

		emitMessageCreate(taskId, broadcastType, {
			mode,
			ts: sayTs,
			type: "say",
			say: type,
			text,
			images,
			partial,
			contextCondense,
			contextTruncation,
		})
	}
}

export function emitCompleteMessage(
	task: TaskType,
	taskId: string,
	broadcastType: string,
	type: NotificationSay,
	mode: string,
	text?: string,
	images?: string[],
	progressStatus?: ToolProgressStatus,
	isUpdatingPreviousPartial?: boolean,
	options: { isNonInteractive?: boolean } = {},
	contextCondense?: ContextCondense,
	contextTruncation?: ContextTruncation,
): void {
	if (isUpdatingPreviousPartial) {
		const partialTs = task._partialMessage!.ts

		if (!options.isNonInteractive) {
			task.setLastMessageTs(partialTs)
		}

		task.clearPartialMessage()

		emitMessageUpdate(task.taskId, broadcastType, {
			mode,
			ts: partialTs,
			type: "say",
			say: type,
			text,
			images,
			partial: false,
			progressStatus,
			contextCondense,
			contextTruncation,
		})
	} else {
		const sayTs = task.generateUniqueTs()

		if (!options.isNonInteractive) {
			task.setLastMessageTs(sayTs)
		}

		emitMessageCreate(taskId, broadcastType, {
			mode,
			ts: sayTs,
			type: "say",
			say: type,
			text,
			images,
			contextCondense,
			contextTruncation,
		})
	}
}
