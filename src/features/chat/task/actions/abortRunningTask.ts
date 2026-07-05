import { getBackendRootStore } from "@features/storeSingleton"

/**
 * Clears the current task from the stack.
 */
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"

export async function popTaskFromStack(_lastMessage?: string): Promise<void> {
	const chat = getBackendRootStore().chat
	const activeTaskId = chat.activeTaskId
	if (activeTaskId) {
		chat.removeTask(activeTaskId)
	}
}

/**
 * Cancels the current task by calling its abort handler.
 */
export async function abortRunningTask(_provider: ProviderHandle): Promise<void> {
	const currentTask = getBackendRootStore().chat.activeTask
	if (currentTask?.abort) {
		currentTask.abortTask()
	}
}
