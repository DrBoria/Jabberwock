import { type Notification } from "@jabberwock/types"
import { getStore } from "@features/singleton"

/**
 * Find a notification by its timestamp (searching from "the" end).
 * Searches in MST store (task.notifications).
 */
export function findNotification(taskId: string, ts: number): Notification | undefined {
	const messages = getStore().chat.tasks.get(taskId)!.notifications.items
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].ts === ts) {
			return messages[i]
		}
	}
	return undefined
}
