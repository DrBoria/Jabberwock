import { type Notification, TelemetryEventName } from "@jabberwock/types"
import { getCloudService, isCloudEnabled } from "@jabberwock/cloud"
import { getTask } from "../../actions/taskRegistry"
import { postStateToWebviewWithoutTaskHistory } from "../../../../foundation/window-manager/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { saveMessages } from "./persistMessages"

/**
 * Add a message to the per-task notifications, notify the webview, and save to disk.
 */
export async function addMessage(taskId: string, message: Notification) {
	const task = getTask(taskId)
	// Push to per-task MST store
	getBackendRootStore().chat.tasks.get(taskId)!.notifications.addNotification(message)

	const provider = task.providerRef!.deref()
	// Avoid resending large, mostly-static fields (notably taskHistory) on every chat message update.
	// taskHistory is maintained in-memory in the webview and updated via taskHistoryItemUpdated.
	if (provider) await postStateToWebviewWithoutTaskHistory(provider)
	// Also send the message directly to the webview so it can render it immediately,
	// even though postStateToWebviewWithoutTaskHistory excludes messages.
	await provider?.postMessageToWebview({ type: "messageUpdated", message: message })

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
