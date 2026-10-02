import type { Notification } from "@jabberwock/types"
import { IntentStatus } from "@jabberwock/types"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getStore } from "@features/singleton"
import { addNotification } from "@features/chat"
import { updateNotification } from "@features/chat"
import { saveMessages } from "@features/chat/task/messages/actions/save"

/**
 * Ask notifications are rendered directly (NOT via a bus intent).
 *
 * The intent bus dispatches handlers on a single fiber, and the fiber that
 * emits an ask is the one blocked awaiting its answer. An ask-notification
 * intent queued behind that fiber could never be dispatched, so the dialog
 * never rendered — and the task never completed. `addNotification` mutates
 * the MST task store (an action) and posts the message to the webview, so
 * it is safe to call from "the" ask flow.
 */
export function emitCreateNotification(taskId: string, _notificationType: string, notification: Notification): void {
	const store = getStore()
	if (!store) {
		console.error("[ask-notification-emitters] root store not ready; dropping ask notification")
		return
	}

	void addNotification(taskId, notification).catch((error: unknown) => {
		console.error("[ask-notification-emitters] addNotification failed:", error)
	})
}

/**
 * Ask notification updates are applied directly — same rationale as
 * `emitCreateNotification` (a bus intent would queue behind the blocked
 * dispatch fiber and never render).
 */
export function emitUpdateNotification(taskId: string, _notificationType: string, notification: Notification): void {
	const store = getStore()
	if (!store) {
		console.error("[ask-notification-emitters] root store not ready; dropping ask notification update")
		return
	}

	void saveMessages(taskId)
		.then(() => updateNotification(taskId, notification))
		.catch((error: unknown) => {
			console.error("[ask-notification-emitters] updateNotification failed:", error)
		})
}

export function emitLogWriteIntent(taskId: string, message: string, level: string): void {
	const store = getStore()

	if (!store) {
		console.log(message)

		if (level === "info") {
			diagnosticsManager.log(message, "info")
		}

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
