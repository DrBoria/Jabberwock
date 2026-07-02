import { type Notification, TelemetryEventName } from "@jabberwock/types"
import { getCloudService, isCloudEnabled } from "@jabberwock/cloud"
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import {
	sendMessageUpdated,
	sendStateWithoutTaskHistory,
} from "@features/chat/task/messages/events/actions/sendMessageEvent"

/**
 * Add a notification to the per-task MST store and notify the webview.
 * File persistence is handled by ChatModel-level reactions (see reactions.ts).
 */
export async function addNotification(taskId: string, message: Notification) {
	const task = getTask(taskId)
	// Push to per-task MST store
	const taskModel = getBackendRootStore().chat.tasks.get(taskId)
	taskModel!.notifications.addNotification(message)

	// Notify the webview via event actions (only code path allowed for postMessage)
	sendStateWithoutTaskHistory()
	sendMessageUpdated(message)

	// TODO(phase-e): Move event emit to reactive layer
	// task.emit(JabberwockEventName.Message, { action: "created", message })

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
