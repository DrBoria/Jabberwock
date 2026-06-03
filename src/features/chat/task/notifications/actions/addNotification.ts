import { type Notification, TelemetryEventName } from "@jabberwock/types"
import { getCloudService, isCloudEnabled } from "@jabberwock/cloud"
import { getTask } from "../../../task/actions/taskRegistry"
import { postStateToWebviewWithoutTaskHistory } from "@features/foundation/window-manager/store"
import { getBackendRootStore } from "@features/storeSingleton"

/**
 * Add a notification to the per-task MST store and notify the webview.
 * File persistence is handled by ChatModel-level reactions (see reactions.ts).
 */
export async function addNotification(taskId: string, message: Notification) {
	const task = getTask(taskId)
	// Push to per-task MST store
	const taskModel = getBackendRootStore().chat.tasks.get(taskId)
	taskModel!.notifications.addNotification(message)

	const providerRef = task.providerRef
	const provider = providerRef !== undefined ? providerRef.deref() : undefined
	if (provider !== undefined) {
		// Avoid resending large, mostly-static fields (notably taskHistory) on every chat message update.
		// taskHistory is maintained in-memory in the webview and updated via taskHistoryItemUpdated.
		await postStateToWebviewWithoutTaskHistory(provider)
		// Also send the message directly to the webview so it can render it immediately,
		// even though postStateToWebviewWithoutTaskHistory excludes messages.
		await provider.postMessageToWebview({ type: "messageUpdated", message })
	}

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
