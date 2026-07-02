import type { Notification } from "@jabberwock/types"
import { IntentStatus } from "@jabberwock/types"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getBackendRootStore } from "@features/storeSingleton"
import { addNotification } from "@features/chat/task/notifications/actions/core/addNotification"

export function emitCreateNotification(taskId: string, notificationType: string, notification: Notification): void {
	const store = getBackendRootStore()

	if (!store) {
		addNotification(taskId, notification)

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

export function emitUpdateNotification(taskId: string, notificationType: string, notification: Notification): void {
	const store = getBackendRootStore()

	if (!store) {
		addNotification(taskId, notification)

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

export function emitLogWriteIntent(taskId: string, message: string, level: string): void {
	const store = getBackendRootStore()

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
