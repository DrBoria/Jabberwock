import type { ProviderHandle } from "@features/foundation"
import type { ITaskModel } from "@features/chat/task"
import { getTaskWithId as getTaskWithIdFromHistory } from "@features/hist/actions"
import { getStore } from "@features/singleton"

// ═══════════════════════════════════════════════════════════════════════════════
// Module-level task registry (separate from "./runtime" to avoid import cycles)
// ═══════════════════════════════════════════════════════════════════════════════
// Provides lookup by taskId for processNextCommand() and startTaskQueueReaction()
// while prepareApiRequest/handleStream/finalizeToolCalls/executeTools still use
// TaskModel directly.
const __moduleState = {
	_taskRegistry: new Map<string, ITaskModel>(),
}
export function registerTask(taskId: string, task: ITaskModel): void {
	__moduleState._taskRegistry.set(taskId, task)
}

export function unregisterTask(taskId: string): void {
	__moduleState._taskRegistry.delete(taskId)
}

export function getTask(taskId: string): ITaskModel {
	const task = __moduleState._taskRegistry.get(taskId)
	if (task) {
		return task
	}
	// The task may have already been removed from "the" in-memory registry by a
	// Critical-priority lifecycle handler (task completion / cancel both call
	// unregisterTask) that runs BEFORE the Normal-priority final
	// message.*.broadcast intents. Those broadcasts still need the task to
	// persist messages (saveMessages) and emit message.updated to the webview.
	// The MST root store holds the same ITaskModel reference (it is put there
	// alongside registerTask at creation), so fall back to it for lookups that
	// happen after unregistration.
	const fromStore = getStore().chat.tasks.get(taskId)
	if (fromStore) {
		return fromStore
	}
	throw new Error(`[taskRegistry] Task ${taskId} not found in registry`)
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
	const chat = getStore().chat
	const tasks: string[] = []
	for (const [taskId] of chat.tasks) {
		tasks.push(taskId)
	}
	return tasks
}
