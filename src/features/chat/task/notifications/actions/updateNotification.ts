import { type Notification, TelemetryEventName } from "@jabberwock/types"
import { getCloudService, isCloudEnabled } from "@jabberwock/cloud"
import { getTask } from "../../../task/actions/taskRegistry"

/**
 * Update a single notification and notify the webview.
 */
export async function updateNotification(taskId: string, message: Notification) {
	const task = getTask(taskId)
	const provider = task.providerRef!.deref()
	await provider?.postMessageToWebview({ type: "messageUpdated", message: message })

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
