import { Anthropic } from "@anthropic-ai/sdk"
import { JabberwockEventName, type TodoItem } from "@jabberwock/types"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getEnvironmentDetails } from "../../../../environment/getEnvironmentDetails"
import { initiateTaskLoop } from "./startTask"
import type { Task } from "../../../../task/Task"

/**
 * Starts a subtask by delegating to the provider.
 * Creates a child task via the provider's delegation mechanism.
 *
 * @param task - The Task instance (parent task)
 * @param message - The message for the subtask
 * @param initialTodos - Initial todo items for the subtask
 * @param mode - The mode for the subtask
 * @returns The created child task, or undefined
 */
export async function startSubtask(task: Task, message: string, initialTodos: TodoItem[], mode: string) {
	const provider = task.providerRef.deref()

	if (!provider) {
		throw new Error("Provider not available")
	}

	const child = await provider.delegateParentAndOpenChild({
		parentTaskId: task.taskId,
		message,
		initialTodos,
		mode,
	})

	if (child && child.taskId) {
		diagnosticsManager.recordTaskStart(child.taskId, "subtask", message, task.taskId)
	}
	return child
}

/**
 * Resumes the parent task after a subtask/delegation completes.
 * Clears ask states, resets abort/streaming flags, loads conversation history,
 * adds fresh environment details, and continues the task loop.
 *
 * @param task - The Task instance (parent task)
 */
export async function resumeAfterDelegation(task: Task): Promise<void> {
	// Clear any ask states that might have been set during history load
	task.idleAsk = undefined
	task.resumableAsk = undefined
	task.interactiveAsk = undefined

	// Reset abort and streaming state to ensure clean continuation
	task.abort = false
	task.abandoned = false
	task.abortReason = undefined
	task.didFinishAbortingStream = false
	task.isStreaming = false
	task.isWaitingForFirstChunk = false

	// Ensure next API call includes full context after delegation
	task.skipPrevResponseIdOnce = true

	// Mark as initialized and active
	task.isInitialized = true
	task.emit(JabberwockEventName.TaskActive, task.taskId)

	// Load conversation history if not already loaded
	if (task.apiConversationHistory.length === 0) {
		task.apiConversationHistory = await task.getSavedApiConversationHistory()
	}

	// Add environment details to the existing last user message (which contains the tool_result)
	// This avoids creating a new user message which would cause consecutive user messages
	const environmentDetails = await getEnvironmentDetails(task, true)
	let lastUserMsgIndex = -1
	for (let i = task.apiConversationHistory.length - 1; i >= 0; i--) {
		if (task.apiConversationHistory[i].role === "user") {
			lastUserMsgIndex = i
			break
		}
	}
	if (lastUserMsgIndex >= 0) {
		const lastUserMsg = task.apiConversationHistory[lastUserMsgIndex]
		if (Array.isArray(lastUserMsg.content)) {
			// Remove any existing environment_details blocks before adding fresh ones
			const environmentDetailsBlock = (lastUserMsg?.content as any[])?.find((block) => {
				if (block.type === "text" && typeof block.text === "string") {
					const isEnvironmentDetailsBlock =
						block.text.trim().startsWith("<environment_details>") &&
						block.text.trim().endsWith("</environment_details>")
					return isEnvironmentDetailsBlock
				}
				return false
			})
			const contentWithoutEnvDetails = lastUserMsg.content.filter(
				(block: Anthropic.Messages.ContentBlockParam) => {
					if (block.type === "text" && typeof block.text === "string") {
						const isEnvironmentDetailsBlock =
							block.text.trim().startsWith("<environment_details>") &&
							block.text.trim().endsWith("</environment_details>")
						return !isEnvironmentDetailsBlock
					}
					return true
				},
			)
			// Add fresh environment details
			lastUserMsg.content = [...contentWithoutEnvDetails, { type: "text" as const, text: environmentDetails }]
		}
	}

	// Save the updated history
	await task.saveApiConversationHistory()

	// Continue task loop - pass empty array to signal no new user content needed
	// The initiateTaskLoop will handle this by skipping user message addition
	await initiateTaskLoop(task, [])
}
