import { getStore } from "@features/singleton"

/**
 * Clears the current task from "the" stack.
 */
import type { ProviderHandle } from "@features/foundation"

export async function popTaskFromStack(_lastMessage?: string): Promise<void> {
	const chat = getStore().chat
	const activeTaskId = chat.activeTaskId
	if (activeTaskId) {
		chat.removeTask(activeTaskId)
	}
}

/**
 * Cancels the current task by calling its abort handler.
 */
export async function abortRunningTask(_provider: ProviderHandle): Promise<void> {
	const currentTask = getStore().chat.activeTask
	if (currentTask?.abort) {
		currentTask.abortTask()
	}
}
