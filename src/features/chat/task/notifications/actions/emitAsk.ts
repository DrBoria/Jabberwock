import type { NotificationAsk, AskResponseValue, Notification, ToolProgressStatus } from "@jabberwock/types"
import { IntentStatus } from "@jabberwock/types"
import { diagnosticsManager } from "@jabberwock/devtool"
import { AskIgnoredError } from "./AskIgnoredError"
import { getTask } from "../../actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import { checkAutoApproval } from "../../../../settings/store"
import { handleWebviewAskResponse } from "./respondToAsk"

/**
 * Shared logic for all ask-specialization action creators.
 *
 * Handles:
 * 1. Task state validation (abort check, task mode readiness)
 * 2. Partial message update logic (same pattern as say.ts)
 * 3. Emitting the specific notification intent for the UI dialog
 * 4. Emitting a log.write intent for diagnostics
 * 5. Auto-approval checking
 * 6. Promise-based response waiting
 *
 * @param taskId - The task ID
 * @param notificationType - The intent constant for the notification (e.g., IntentConstants.notifications.ASK_TOOL_APPROVAL)
 * @param type - The NotificationAsk type
 * @param text - Optional message text
 * @param partial - Whether this is a partial (streaming) message
 * @param progressStatus - Optional tool progress status
 * @param isProtected - Whether this ask is protected
 * @returns The user's response
 */
export async function emitAsk(
	taskId: string,
	notificationType: string,
	type: NotificationAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: AskResponseValue; text?: string; images?: string[] }> {
	const task = getTask(taskId)

	// BUG FIX: Wait for task mode initialization before accessing task._state._taskMode
	await task.taskModeReady

	if (task._state.abort) {
		throw new Error(`[Jabberwock#ask] task ${task.taskId}.${task.instanceId} aborted`)
	}

	// Read notifications from per-task MST store
	const taskModel = getBackendRootStore().chat.tasks.get(taskId)!
	const messages = taskModel.notifications.items

	let askTs: number

	if (partial !== undefined) {
		const lastMessage = messages.at(-1)
		const isUpdatingPreviousPartial =
			lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type

		if (partial) {
			if (isUpdatingPreviousPartial) {
				lastMessage.text = text
				lastMessage.partial = partial
				lastMessage.progressStatus = progressStatus
				lastMessage.isProtected = isProtected
				emitUpdateNotification(task.taskId, notificationType, lastMessage)
				throw new AskIgnoredError("updating existing partial")
			} else {
				askTs = task.generateUniqueTs()
				task.lastMessageTs = askTs
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
		} else {
			if (isUpdatingPreviousPartial) {
				askTs = lastMessage.ts
				task.lastMessageTs = askTs
				lastMessage.text = text
				lastMessage.partial = false
				lastMessage.progressStatus = progressStatus
				lastMessage.isProtected = isProtected
				emitUpdateNotification(task.taskId, notificationType, lastMessage)
			} else {
				askTs = task.generateUniqueTs()
				task.lastMessageTs = askTs
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
	} else {
		askTs = task.generateUniqueTs()
		task.lastMessageTs = askTs
		const notification: Notification = {
			mode: task._state._taskMode,
			ts: askTs,
			type: "ask",
			ask: type,
			text,
			isProtected,
		}
		emitCreateNotification(taskId, notificationType, notification)

		// Emit log.write intent
		emitLogWriteIntent(taskId, `[TODO-LOG] [Task] Ask created (taskId: ${task.taskId}, type: ${type})`, "info")
	}

	const approval = await checkAutoApproval({ state: undefined, ask: type, text, isProtected })

	if (approval.decision === "approve") {
		handleWebviewAskResponse(taskId, "yesButtonClicked")
	} else if (approval.decision === "deny") {
		handleWebviewAskResponse(taskId, "noButtonClicked")
	} else if (approval.decision === "timeout") {
		task.autoApprovalTimeoutRef = setTimeout(() => {
			const { askResponse, text, images } = approval.fn()
			handleWebviewAskResponse(taskId, askResponse, text, images)
			task.autoApprovalTimeoutRef = undefined
		}, approval.timeout)
	} else if (approval.decision === "ask") {
		task.askShownAt = Date.now()
	}

	// Use a promise-based ask resolver
	const askPromise = new Promise<{ response: AskResponseValue; text?: string; images?: string[] }>((resolve) => {
		task.askResolve = resolve
	})

	const result = await askPromise

	return result
}

/**
 * Emit a notification create intent.
 */
function emitCreateNotification(taskId: string, notificationType: string, notification: Notification): void {
	const store = getBackendRootStore()
	if (!store) {
		// Fallback: use inline import to avoid circular deps
		void import("./addNotification").then(({ addNotification }) => addNotification(taskId, notification))
		return
	}
	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: notificationType,
		payload: { taskId, notification },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

/**
 * Emit a notification update intent.
 */
function emitUpdateNotification(taskId: string, notificationType: string, notification: Notification): void {
	const store = getBackendRootStore()
	if (!store) {
		void import("./addNotification").then(({ addNotification }) => addNotification(taskId, notification))
		return
	}
	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: notificationType,
		payload: { taskId, notification, action: "update" },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

/**
 * Emit a log.write intent.
 */
function emitLogWriteIntent(taskId: string, message: string, level: string): void {
	const store = getBackendRootStore()
	if (!store) {
		console.log(message)
		if (level === "info") diagnosticsManager.log(message, "info")
		return
	}
	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: "log.write",
		payload: { taskId, message, level },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}
