import type { Notification } from "@jabberwock/types"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"

export function emitMessageCreate(taskId: string, broadcastType: string, notification: Notification): void {
	const store = getStore()

	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: broadcastType,
		payload: { taskId, notification, action: "create" },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

export function emitMessageUpdate(taskId: string, broadcastType: string, notification: Notification): void {
	const store = getStore()

	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: broadcastType,
		payload: { taskId, notification, action: "update" },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}
