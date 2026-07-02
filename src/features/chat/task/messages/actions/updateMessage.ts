import { type Notification, TelemetryEventName } from "@jabberwock/types"
import { getCloudService, isCloudEnabled } from "@jabberwock/cloud"
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { restoreTodoListForTask } from "@features/chat/tools"
import { getBackendRootStore } from "@features/storeSingleton"
import { saveMessages } from "./saveMessages"
import { sendMessageUpdated } from "@features/chat/task/messages/events/actions/sendMessageEvent"

/**
 * Overwrite all messages with a new array.
 */
export async function overwriteMessages(taskId: string, newMessages: Notification[]) {
	const task = getTask(taskId)
	// Overwrite per-task MST store notifications
	getBackendRootStore().chat.tasks.get(taskId)!.notifications.setNotifications(newMessages)

	restoreTodoListForTask(task)
	await saveMessages(taskId)

	// TODO(phase-i): Move cloud sync tracking to MST store
	// task.cloudSyncedMessageTimestamps.clear()
	// for (const msg of newMessages) {
	// 	if (msg.partial !== true) {
	// 		task.cloudSyncedMessageTimestamps.add(msg.ts)
	// 	}
	// }
}

/**
 * Update a single message and notify the webview.
 */
export async function updateMessage(taskId: string, message: Notification) {
	const task = getTask(taskId)
	// Notify the webview via event action (only code path allowed for postMessage)
	sendMessageUpdated(message)

	// TODO(phase-e): Move event emit to reactive layer
	// task.emit(JabberwockEventName.Message, { action: "updated", message })

	// Check if we should sync to cloud
	const shouldCaptureMessage = message.partial !== true && isCloudEnabled()

	// TODO(phase-i): Move cloud sync tracking to MST store
	// const hasNotBeenSynced = !task.cloudSyncedMessageTimestamps.has(message.ts)

	if (shouldCaptureMessage) {
		getCloudService().captureEvent({
			event: TelemetryEventName.TASK_MESSAGE,
			properties: { taskId: task.taskId, message },
		})
		// TODO(phase-i): task.cloudSyncedMessageTimestamps.add(message.ts)
	}
}
