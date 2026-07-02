import { type Notification, TelemetryEventName } from "@jabberwock/types"
import { getCloudService, isCloudEnabled } from "@jabberwock/cloud"
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import { saveMessages } from "./saveMessages"
import {
	sendMessageUpdated,
	sendStateWithoutTaskHistory,
} from "@features/chat/task/messages/events/actions/sendMessageEvent"

/**
 * Add a message to the per-task notifications, notify the webview, and save to disk.
 */
export async function addMessage(taskId: string, message: Notification) {
	const task = getTask(taskId)
	// Push to per-task MST store
	getBackendRootStore().chat.tasks.get(taskId)!.notifications.addNotification(message)

	// Notify the webview via event actions (only code path allowed for postMessage)
	sendStateWithoutTaskHistory()
	sendMessageUpdated(message)

	// TODO(phase-e): Move event emit to reactive layer
	// task.emit(JabberwockEventName.Message, { action: "created", message })

	await saveMessages(taskId)

	const shouldCaptureMessage = message.partial !== true && isCloudEnabled()

	if (shouldCaptureMessage) {
		getCloudService().captureEvent({
			event: TelemetryEventName.TASK_MESSAGE,
			properties: { taskId: task.taskId, message },
		})
		// TODO(phase-i): Move cloud sync tracking to MST store
		// task.cloudSyncedMessageTimestamps.add(message.ts)
	}
}
