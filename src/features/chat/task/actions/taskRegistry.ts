import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { ITaskModel } from "@features/chat/task/store"
import { getTaskWithId as getTaskWithIdFromHistory } from "@features/hist/actions"
import { getBackendRootStore } from "@features/storeSingleton"

// ═══════════════════════════════════════════════════════════════════════════════
// Module-level task registry (separate from ./runtime to avoid import cycles)
// ═══════════════════════════════════════════════════════════════════════════════
// Provides lookup by taskId for processNextCommand() and startTaskQueueReaction()
// while prepareApiRequest/handleStream/finalizeToolCalls/executeTools still use
// TaskModel directly.
const _taskRegistry = new Map<string, ITaskModel>()

export function registerTask(taskId: string, task: ITaskModel): void {
	_taskRegistry.set(taskId, task)
}

export function unregisterTask(taskId: string): void {
	_taskRegistry.delete(taskId)
}

export function getTask(taskId: string): ITaskModel {
	const task = _taskRegistry.get(taskId)
	if (!task) {
		throw new Error(`[taskRegistry] Task ${taskId} not found in registry`)
	}
	return task
}

/**
 * Checks if a task with the given ID is in the task history.
 */
export async function isTaskInHistory(provider: ProviderHandle, taskId: string): Promise<boolean> {
	try {
		await getTaskWithIdFromHistory(taskId)
		return true
	} catch {
		return false
	}
}

/**
 * Returns the current task stack (array of task IDs).
 */
export function getCurrentTaskStack(): string[] {
	const chat = getBackendRootStore().chat
	const tasks: string[] = []
	for (const [taskId] of chat.tasks) {
		tasks.push(taskId)
	}
	return tasks
}
