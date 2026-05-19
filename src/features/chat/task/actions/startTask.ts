import { Anthropic } from "@anthropic-ai/sdk"
import { Task } from "../Task"
import type { EventBridge } from "../../../../core/webview/EventBridge"
import { JabberwockEventName, type ProviderSettings } from "@jabberwock/types"
import { checkExistKey } from "../../../../shared/checkExistApiConfig"

/**
 * Starts a new task with the given text and images.
 */

export async function startTask(task: Task, taskText?: string, images?: string[]): Promise<void> {
	if (typeof task.initiateTaskLoop === "function") {
		// Display the user's initial message in the chat as a visible say("text") clineMessage.
		// Without this, the user's text exists only in apiConversationHistory (for the API)
		// but never appears in the webview's message list — the webview only renders from clineMessages.
		if (taskText && typeof task.say === "function") {
			await task.say("text", taskText, images)
		}
		const userContent = taskText ? [{ type: "text" as const, text: taskText }] : []
		await task.initiateTaskLoop(userContent)
	}
}

/**
 * Creates a task with the given history item.
 */
export async function createTaskWithHistoryItem(provider: EventBridge, historyItem: unknown): Promise<Task> {
	const currentTask = provider.getCurrentTask()
	if (
		currentTask &&
		"resumeTaskFromHistory" in currentTask &&
		typeof (currentTask as { resumeTaskFromHistory: () => Promise<void> }).resumeTaskFromHistory === "function"
	) {
		await (currentTask as { resumeTaskFromHistory: () => Promise<void> }).resumeTaskFromHistory()
	}
	return currentTask as Task
}

/**
 * Alias for startTask, used by Task.start().
 */
export const start = startTask

/**
 * Creates a new task from the given provider with text/images/configuration.
 * Used by newTask handler and API to create/start tasks.
 */
export async function createTask(
	provider: EventBridge,
	text?: string,
	images?: string[],
	taskConfiguration?: Record<string, unknown>,
	_extra?: unknown,
): Promise<Task> {
	const currentTask = provider.getCurrentTask()
	if (currentTask && text) {
		await startTask(currentTask as Task, text, images)
		return currentTask as Task
	}

	// When no current task exists and text is provided, create a brand-new
	// Task instance and add it to the provider's task stack. Without this
	// branch the function silently returns undefined, and the calling handler
	// (e.g. newTask) only sends invoke:"newChat" — no task is ever created
	// and the webview stays on HomeScreen indefinitely.
	if (text) {
		const state = await provider.getState()
		// getState() enriches the MST snapshot with apiConfiguration from
		// ProviderSettingsManager (see EventBridge.getState). This mirrors the
		// enrichment that postStateToWebview() performs, ensuring that the
		// Task constructor receives the current API configuration that
		// buildApiHandler() needs to function correctly.
		const newTask = new Task({
			provider,
			apiConfiguration: state.apiConfiguration as ProviderSettings,
			task: text,
			images: images ?? [],
			startTask: false,
			taskId: (taskConfiguration as { taskId?: string } | undefined)?.taskId,
		})
		await provider.addClineToStack(newTask)
		await startTask(newTask, text, images)
		return newTask
	}

	return currentTask as Task
}

/**
 * Starts a background subtask (non-blocking).
 * Unlike delegateParentAndOpenChild, the parent task continues running.
 */
export async function startBackgroundTask(
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
		throw new Error(`[startBackgroundTask] Parent task ${parentTaskId} not found`)
	}

	if (typeof parentTask.startSubtask !== "function") {
		throw new Error(`[startBackgroundTask] Parent task ${parentTaskId} has no startSubtask method`)
	}

	// Create a subtask using the parent task's startSubtask method
	const childTask = await parentTask.startSubtask(message, (initialTodos ?? []) as [], mode ?? "")
	if (!childTask) {
		throw new Error(`[startBackgroundTask] Failed to create subtask for task ${parentTaskId}`)
	}

	return childTask
}
