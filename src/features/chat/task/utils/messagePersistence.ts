import { type ClineMessage, JabberwockEventName, TelemetryEventName } from "@jabberwock/types"
import { CloudService, getCloudService, isCloudEnabled } from "@jabberwock/cloud"
import { saveTaskMessages, saveApiMessages, taskMetadata } from "../../../../core/task-persistence"
import { restoreTodoListForTask } from "../../../../core/tools/UpdateTodoListTool"
import { defaultModeSlug } from "../../../../shared/modes"
import { Task } from "../Task"
import { postStateToWebviewWithoutTaskHistory } from "../../../foundation/window-manager/store"
import { updateTaskHistory } from "../../../history/store"

/**
 * Save the API conversation history to disk.
 */
export async function saveApiConversationHistory(task: Task): Promise<boolean> {
	try {
		await saveApiMessages({
			messages: structuredClone(task.apiConversationHistory),
			taskId: task.taskId,
			globalStoragePath: task.globalStoragePath,
		})
		return true
	} catch (error) {
		console.error("Failed to save API conversation history:", error)
		return false
	}
}

/**
 * Add a message to the clineMessages array and notify the webview.
 */
export async function addToClineMessages(task: Task, message: ClineMessage) {
	task.clineMessages.push(message)
	const provider = task.providerRef.deref()
	// Avoid resending large, mostly-static fields (notably taskHistory) on every chat message update.
	// taskHistory is maintained in-memory in the webview and updated via taskHistoryItemUpdated.
	if (provider) await postStateToWebviewWithoutTaskHistory(provider)
	// Also send the message directly to the webview so it can render it immediately,
	// even though postStateToWebviewWithoutTaskHistory excludes clineMessages.
	await provider?.postMessageToWebview({ type: "messageUpdated", clineMessage: message })
	task.emit(JabberwockEventName.Message, { action: "created", message })
	await saveClineMessages(task)

	const shouldCaptureMessage = message.partial !== true && isCloudEnabled()

	if (shouldCaptureMessage) {
		getCloudService().captureEvent({
			event: TelemetryEventName.TASK_MESSAGE,
			properties: { taskId: task.taskId, message },
		})
		// Track that this message has been synced to cloud
		task.cloudSyncedMessageTimestamps.add(message.ts)
	}
}

/**
 * Overwrite all clineMessages with a new array.
 */
export async function overwriteClineMessages(task: Task, newMessages: ClineMessage[]) {
	task.clineMessages = newMessages
	restoreTodoListForTask(task)
	await saveClineMessages(task)

	// When overwriting messages (e.g., during task resume), repopulate the cloud sync tracking Set
	// with timestamps from all non-partial messages to prevent re-syncing previously synced messages
	task.cloudSyncedMessageTimestamps.clear()
	for (const msg of newMessages) {
		if (msg.partial !== true) {
			task.cloudSyncedMessageTimestamps.add(msg.ts)
		}
	}
}

/**
 * Update a single clineMessage and notify the webview.
 */
export async function updateClineMessage(task: Task, message: ClineMessage) {
	const provider = task.providerRef.deref()
	await provider?.postMessageToWebview({ type: "messageUpdated", clineMessage: message })
	task.emit(JabberwockEventName.Message, { action: "updated", message })

	// Check if we should sync to cloud and haven't already synced this message
	const shouldCaptureMessage = message.partial !== true && isCloudEnabled()
	const hasNotBeenSynced = !task.cloudSyncedMessageTimestamps.has(message.ts)

	if (shouldCaptureMessage && hasNotBeenSynced) {
		getCloudService().captureEvent({
			event: TelemetryEventName.TASK_MESSAGE,
			properties: { taskId: task.taskId, message },
		})
		// Track that this message has been synced to cloud
		task.cloudSyncedMessageTimestamps.add(message.ts)
	}
}

/**
 * Save clineMessages to disk and sync to MST store.
 */
export async function saveClineMessages(task: Task): Promise<boolean> {
	try {
		await saveTaskMessages({
			messages: structuredClone(task.clineMessages),
			taskId: task.taskId,
			globalStoragePath: task.globalStoragePath,
		})

		// Phase 4: Sync UI messages to MST
		const providerInstance = task.providerRef.deref()
		if (providerInstance && providerInstance.chatStore) {
			const node = providerInstance.chatStore.nodes.get(task.taskId)
			if (node) {
				// We freeze/clone because MobX needs isolated models from raw JS objects
				node.syncUiMessages(structuredClone(task.clineMessages))
			}
		}

		if (task._taskApiConfigName === undefined) {
			await task.taskApiConfigReady
		}

		const { historyItem, tokenUsage } = await taskMetadata({
			taskId: task.taskId,
			rootTaskId: task.rootTaskId,
			parentTaskId: task.parentTaskId,
			taskNumber: task.taskNumber,
			messages: task.clineMessages,
			globalStoragePath: task.globalStoragePath,
			workspace: task.cwd,
			mode: task._taskMode || defaultModeSlug,
			apiConfigName: task._taskApiConfigName,
			initialStatus: task.initialStatus,
		})

		// Emit token/tool usage updates using debounced function
		task.debouncedEmitTokenUsage(tokenUsage, task.toolUsage)

		const provider = task.providerRef.deref()
		if (provider) {
			await updateTaskHistory(provider, historyItem)
		}
		return true
	} catch (error) {
		console.error("Failed to save Jabberwock messages:", error)
		return false
	}
}

/**
 * Find a clineMessage by its timestamp (searching from the end).
 */
export function findMessageByTimestamp(task: Task, ts: number): ClineMessage | undefined {
	const messages = task.clineMessages as ClineMessage[]
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].ts === ts) {
			return messages[i]
		}
	}
	return undefined
}
