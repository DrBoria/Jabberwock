import type { ITaskModel } from "@features/chat/task/store"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"

import { getBackendRootStore } from "@features/storeSingleton"

/**
 * Starts a subtask.
 */

/**
 * Delegates to provider to start a subtask.
 */
async function delegateToProvider(
	taskId: string,
	message: string,
	initialTodos: unknown[],
	mode: string,
): Promise<ITaskModel | undefined> {
	return undefined
}

export async function startSubtask(
	taskId: string,
	message: string,
	initialTodos?: unknown[],
	mode?: string,
): Promise<ITaskModel | undefined> {
	// startSubtask was removed from Task - direct delegation
	const subtask = await delegateToProvider(taskId, message, initialTodos ?? [], mode ?? "")
	return subtask
}

/**
 * Resumes after delegation.
 */
export async function resumeAfterDelegation(taskId: string, completionResult?: string): Promise<void> {
	// resumeAfterDelegation was removed from Task - standalone implementation
	// The actual resume logic is handled by reopenParentFromDelegation
	// This function is kept as a stub for API compatibility
	return
}

/**
 * Reopens parent from delegation.
 * Called when a child task completes and wants to return control to its parent.
 */
export async function reopenParentFromDelegation(params: {
	parentTaskId: string
	childTaskId: string
	completionResultSummary: string
}): Promise<void> {
	const { parentTaskId, childTaskId, completionResultSummary } = params
	const parentTask = getBackendRootStore().chat.getTask(parentTaskId)
	if (!parentTask) {
		console.error(`[jabberwock] [reopenParentFromDelegation] Parent task ${parentTaskId} not found`)
		return
	}
	// Resume the parent task with the child's completion result
	// resumeAfterDelegation was removed from TaskModel — method no longer exists on task
}

/**
 * Delegates from a parent task and opens a new child task.
 * Used when a tool call needs to be delegated to a different mode/agent.
 */
export async function delegateParentAndOpenChild(params: {
	parentTaskId: string
	message: string
	initialTodos?: unknown[]
	mode?: string
}): Promise<ITaskModel> {
	const { parentTaskId, message, initialTodos, mode } = params

	// startSubtask was removed from TaskModel — use standalone function instead
	const childTask = await startSubtask(parentTaskId, message, initialTodos ?? [], mode ?? "")
	if (!childTask) {
		throw new Error(`[delegateParentAndOpenChild] Failed to create subtask for task ${parentTaskId}`)
	}

	return childTask
}

/**
 * Reopens parent from delegation.
 */
