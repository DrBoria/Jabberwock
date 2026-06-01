import type { EventBridge } from "../../../../features/foundation/webview/EventBridge"
import { getBackendRootStore } from "@features/storeSingleton"
import { postStateToWebview } from "../../../foundation/window-manager/store"

/**
 * Clears the current task from the stack.
 */
export async function popTaskFromStack(provider: EventBridge, _lastMessage?: string): Promise<void> {
	const chat = getBackendRootStore().chat
	const activeTaskId = chat.activeTaskId
	if (activeTaskId) {
		chat.removeTask(activeTaskId)
	}
	await postStateToWebview(provider)
}

/**
 * Cancels the current task by calling its abort handler.
 */
export async function abortRunningTask(provider: EventBridge): Promise<void> {
	const currentTask = getBackendRootStore().chat.activeTask
	if (currentTask?.abort) {
		currentTask.abortTask()
	}
}
