import { type Notification } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"

/**
 * Find a notification by its timestamp (searching from the end).
 * Searches in MST store (task.notifications).
 */
export function findNotification(taskId: string, ts: number): Notification | undefined {
	const messages = getBackendRootStore().chat.tasks.get(taskId)!.notifications.items
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].ts === ts) {
			return messages[i]
		}
	}
	return undefined
}
