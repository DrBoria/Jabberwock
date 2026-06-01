import { when } from "mobx"

import { Anthropic } from "@anthropic-ai/sdk"

import type { ApiMessage } from "../../task/messages/actions/saveApiConversation"
import { getEffectiveApiHistory } from "../../task/condense/handlers/on-context-condense"
import { validateAndFixToolResultIds } from "./validateToolResultIds"
import type { ITaskModel } from "../../task/store"

/**
 * Flushes pending tool results (user message content) to the API conversation history.
 * Waits for the assistant message to be saved first if needed, to ensure correct ordering
 * of tool_use and tool_result blocks.
 */
export async function flushPendingToolResultsToHistory(task: ITaskModel): Promise<boolean> {
	// Only flush if there's actually pending content to save
	if (task.userMessageContent.length === 0) {
		return true
	}

	// CRITICAL: Wait for the assistant message to be saved to API history first.
	// Without this, tool_result blocks would appear BEFORE tool_use blocks in the
	// conversation history, causing API errors like:
	// "unexpected `tool_use_id` found in `tool_result` blocks"
	//
	// This can happen when parallel tools are called (e.g., update_todo_list + new_task).
	// Tools execute during streaming via presentAssistantMessage, BEFORE the assistant
	// message is saved. When new_task triggers delegation, it calls this method to
	// flush pending results - but the assistant message hasn't been saved yet.
	//
	// The assistantMessageSavedToHistory flag is:
	// - Reset to false at the start of each API request
	// - Set to true after the assistant message is saved in recursivelyMakeClineRequests
	if (!task._state.assistantMessageSavedToHistory) {
		await when(() => task._state.assistantMessageSavedToHistory || task._state.abort, {
			timeout: 30_000, // 30 second timeout as safety net
		}).catch(() => {
			// If timeout or abort, log and proceed anyway to avoid hanging
			console.warn(
				`[Task#${task.taskId}] flushPendingToolResultsToHistory: timed out waiting for assistant message to be saved`,
			)
		})
	}

	// If task was aborted while waiting, don't flush
	if (task._state.abort) {
		return false
	}

	// Save the user message with tool_result blocks
	const userMessage: Anthropic.MessageParam = {
		role: "user",
		content: task.userMessageContent,
	}

	// Validate and fix tool_result IDs when the previous *effective* message is an assistant message.
	const effectiveHistoryForValidation = getEffectiveApiHistory(task.apiConversationHistory)
	const lastEffective = effectiveHistoryForValidation[effectiveHistoryForValidation.length - 1]
	const historyForValidation = lastEffective?.role === "assistant" ? effectiveHistoryForValidation : []
	const validatedMessage = validateAndFixToolResultIds(userMessage, historyForValidation)
	const userMessageWithTs = { ...validatedMessage, ts: task.generateUniqueTs() }
	task.apiConversationHistory.push(userMessageWithTs as ApiMessage)

	await task.saveApiConversationHistory?.()

	// Clear the pending content since it's now saved
	task.userMessageContent = []

	return true
}
