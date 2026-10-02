import { type Notification } from "@jabberwock/types"
import { getTask } from "@features/chat"
import { restoreTodoListForTask } from "@features/chat/tools"
import { getStore } from "@features/singleton"

/**
 * Overwrite all notifications with a new array in the per-task MST store.
 * File persistence is handled by ChatModel-level reactions (see reactions.ts).
 */
export async function overwriteNotifications(taskId: string, newMessages: Notification[]) {
	const task = getTask(taskId)
	// Overwrite per-task MST store notifications
	getStore().chat.tasks.get(taskId)!.notifications.setNotifications(newMessages)

	restoreTodoListForTask(task)

	// TODO(phase-i): Move cloud sync tracking to MST store
	// task.cloudSyncedMessageTimestamps.clear()
	// for (const msg of newMessages) {
	// 	if (msg.partial !== true) {
	// 		task.cloudSyncedMessageTimestamps.add(msg.ts)
	// 	}
	// }
}
