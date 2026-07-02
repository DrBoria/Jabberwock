import { getBackendRootStore } from "@features/storeSingleton"
import type { ITaskModel } from "@features/chat/task/store"

export async function startBackgroundTask(params: {
	parentTaskId: string
	message: string
	initialTodos?: unknown[]
	mode?: string
}): Promise<ITaskModel> {
	const { parentTaskId, message, initialTodos, mode } = params

	const parentTask = getBackendRootStore().chat.getTask(parentTaskId)

	if (!parentTask) {
		throw new Error(`[startBackgroundTask] Parent task ${parentTaskId} not found`)
	}

	const startSubtaskFn = Reflect.get(parentTask, "startSubtask")

	if (typeof startSubtaskFn !== "function") {
		throw new Error(`[startBackgroundTask] Parent task ${parentTaskId} has no startSubtask method`)
	}

	const childTask = await startSubtaskFn.call(parentTask, message, initialTodos ?? [], mode ?? "")

	if (!childTask) {
		throw new Error(`[startBackgroundTask] Failed to create subtask for task ${parentTaskId}`)
	}

	return childTask
}
