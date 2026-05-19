import type { Task } from "../Task"
import type { EventBridge, TaskStub } from "../../../../core/webview/EventBridge"
import type { TodoItem } from "@jabberwock/types"
import { getTaskWithId } from "../../../history/store"
import { postStateToWebview } from "../../../foundation/window-manager/store"

/**
 * Starts a subtask.
 */
export async function startSubtask(
	task: Task,
	message: string,
	initialTodos?: unknown[],
	mode?: string,
): Promise<Task | undefined> {
	if (typeof task.startSubtask === "function") {
		return task.startSubtask(message, (initialTodos ?? []) as TodoItem[], mode ?? "")
	}
	return undefined
}

/**
 * Resumes after delegation.
 */
export async function resumeAfterDelegation(task: Task, completionResult?: string): Promise<void> {
	if (typeof task.resumeAfterDelegation === "function") {
		await task.resumeAfterDelegation()
	}
}

/**
 * Reopens parent from delegation.
 * Called when a child task completes and wants to return control to its parent.
 */
export async function reopenParentFromDelegation(
	provider: EventBridge,
	params: {
		parentTaskId: string
		childTaskId: string
		completionResultSummary: string
	},
): Promise<void> {
	const { parentTaskId, childTaskId, completionResultSummary } = params
	const parentTask = await provider.getTaskWithId(parentTaskId)
	if (!parentTask) {
		console.error(`[reopenParentFromDelegation] Parent task ${parentTaskId} not found`)
		return
	}
	// Resume the parent task with the child's completion result
	if (typeof parentTask.resumeAfterDelegation === "function") {
		await parentTask.resumeAfterDelegation()
	}
}

/**
 * Delegates from a parent task and opens a new child task.
 * Used when a tool call needs to be delegated to a different mode/agent.
 */
export async function delegateParentAndOpenChild(
	provider: EventBridge,
	params: {
		parentTaskId: string
		message: string
		initialTodos?: unknown[]
		mode?: string
	},
): Promise<Task> {
	const { parentTaskId, message, initialTodos, mode } = params

	const parentTask = await provider.getTaskWithId(parentTaskId)
	if (!parentTask) {
		throw new Error(`[delegateParentAndOpenChild] Parent task ${parentTaskId} not found`)
	}

	if (typeof parentTask.startSubtask !== "function") {
		throw new Error(`[delegateParentAndOpenChild] Parent task ${parentTaskId} has no startSubtask method`)
	}

	// Create a subtask using the parent task's startSubtask method
	const childTask = await parentTask.startSubtask(message, (initialTodos ?? []) as [], mode ?? "")
	if (!childTask) {
		throw new Error(`[delegateParentAndOpenChild] Failed to create subtask for task ${parentTaskId}`)
	}

	return childTask
}

/**
 * Reopens parent from delegation.
 */
