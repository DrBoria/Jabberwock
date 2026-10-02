import type { Notification, NotificationAsk, ToolProgressStatus } from "@jabberwock/types"
import { getTask } from "@features/chat"
import { AskIgnoredError } from "@features/chat"
import {
	emitCreateNotification,
	emitUpdateNotification,
	emitLogWriteIntent,
} from "@features/chat/task/notifications/actions/emitAsk/ask-notification-emitters"

type TaskType = ReturnType<typeof getTask>

export function onAskPartialMessage(
	task: TaskType,
	taskId: string,
	notificationType: string,
	type: NotificationAsk,
	text: string | undefined,
	partial: boolean,
	progressStatus: ToolProgressStatus | undefined,
	isProtected: boolean | undefined,
	messages: Notification[],
): void {
	const lastMessage = messages.at(-1)
	const isUpdatingPreviousPartial =
		lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type

	if (partial) {
		handleAskPartialUpdate(
			task,
			taskId,
			notificationType,
			type,
			text,
			partial,
			progressStatus,
			isProtected,
			lastMessage,
			isUpdatingPreviousPartial,
		)
	} else {
		handleAskCompleteUpdate(
			task,
			taskId,
			notificationType,
			type,
			text,
			progressStatus,
			isProtected,
			lastMessage,
			isUpdatingPreviousPartial,
		)
	}
}

function handleAskPartialUpdate(
	task: TaskType,
	taskId: string,
	notificationType: string,
	type: NotificationAsk,
	text: string | undefined,
	partial: boolean,
	progressStatus: ToolProgressStatus | undefined,
	isProtected: boolean | undefined,
	lastMessage: Notification | undefined,
	isUpdatingPreviousPartial: boolean | undefined,
): void {
	if (isUpdatingPreviousPartial) {
		// lastMessage is a frozen MST node — cannot mutate in place. Build a new
		// object and let emitUpdateNotification deliver it to the webview.
		const updated: Notification = {
			...(lastMessage! as Notification),
			text,
			partial,
			progressStatus,
			isProtected,
		}
		emitUpdateNotification(task.taskId, notificationType, updated)
		throw new AskIgnoredError("updating existing partial")
	}

	const askTs = task.generateUniqueTs()
	task.setLastMessageTs(askTs)
	const notification: Notification = {
		mode: task._state._taskMode,
		ts: askTs,
		type: "ask",
		ask: type,
		text,
		partial,
		isProtected,
	}
	emitCreateNotification(taskId, notificationType, notification)
	throw new AskIgnoredError("new partial")
}

function handleAskCompleteUpdate(
	task: TaskType,
	taskId: string,
	notificationType: string,
	type: NotificationAsk,
	text: string | undefined,
	progressStatus: ToolProgressStatus | undefined,
	isProtected: boolean | undefined,
	lastMessage: Notification | undefined,
	isUpdatingPreviousPartial: boolean | undefined,
): void {
	if (isUpdatingPreviousPartial) {
		const askTs = lastMessage!.ts
		task.setLastMessageTs(askTs)
		// lastMessage is a frozen MST node — cannot mutate in place. Build a new
		// object and let emitUpdateNotification deliver it to the webview.
		const updated: Notification = {
			...(lastMessage! as Notification),
			text,
			partial: false,
			progressStatus,
			isProtected,
		}
		emitUpdateNotification(task.taskId, notificationType, updated)
	} else {
		const askTs = task.generateUniqueTs()
		task.setLastMessageTs(askTs)
		const notification: Notification = {
			mode: task._state._taskMode,
			ts: askTs,
			type: "ask",
			ask: type,
			text,
			isProtected,
		}
		emitCreateNotification(taskId, notificationType, notification)
	}
}

export function onAskNonPartialMessage(
	task: TaskType,
	taskId: string,
	notificationType: string,
	type: NotificationAsk,
	text: string | undefined,
	isProtected: boolean | undefined,
): void {
	const askTs = task.generateUniqueTs()
	task.setLastMessageTs(askTs)
	const notification: Notification = {
		mode: task._state._taskMode,
		ts: askTs,
		type: "ask",
		ask: type,
		text,
		isProtected,
	}
	emitCreateNotification(taskId, notificationType, notification)

	emitLogWriteIntent(taskId, `[TODO-LOG] [Task] Ask created (taskId: ${task.taskId}, type: ${type})`, "info")
}
