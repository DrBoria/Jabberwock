import { type Notification } from "@jabberwock/types"
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { restoreTodoListForTask } from "@features/chat/tools"
import { getBackendRootStore } from "@features/storeSingleton"

/**
 * Overwrite all notifications with a new array in the per-task MST store.
 * File persistence is handled by ChatModel-level reactions (see reactions.ts).
 */
export async function overwriteNotifications(taskId: string, newMessages: Notification[]) {
	const task = getTask(taskId)
	// Overwrite per-task MST store notifications
	getBackendRootStore().chat.tasks.get(taskId)!.notifications.setNotifications(newMessages)

	restoreTodoListForTask(task)

	// TODO(phase-i): Move cloud sync tracking to MST store
	// task.cloudSyncedMessageTimestamps.clear()
	// for (const msg of newMessages) {
	// 	if (msg.partial !== true) {
	// 		task.cloudSyncedMessageTimestamps.add(msg.ts)
	// 	}
	// }
}
