import { type Notification, TelemetryEventName } from "@jabberwock/types"
import { getCloudService, isCloudEnabled } from "@jabberwock/cloud"
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { sendMessageUpdated } from "@features/chat/task/messages/events/actions/sendMessageEvent"

/**
 * Update a single notification and notify the webview.
 */
export async function updateNotification(taskId: string, message: Notification) {
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
