import { Anthropic } from "@anthropic-ai/sdk"

import type { ITaskModel } from "../../task/store"
import { ask } from "../../task/notifications/actions/ask"
import { systemBroadcast } from "../../task/messages/actions/say"
import { getBackendRootStore } from "@features/storeSingleton"
import { addToApiConversationHistory } from "../../task/messages/actions/apiHistoryPersistence"
import { getTask as getRegisteredTask } from "../../task/actions/taskRegistry"
import { type TaskDelegate } from "../../task/condense/actions/types"
import type { AssistantMessageContent } from "../../task/messages/actions/types"
import { waitForToolExecutionAndPrepareNextContent } from "./toolCallExecutor"

// ── E.5: executeTools ──────────────────────────────────────────────────────────

/**
 * Executes tool calls from the assistant message and returns the next user content.
 *
 * Calls waitForToolExecutionAndPrepareNextContent() which handles:
 * - Tool execution orchestration
 * - Tool result collection
 * - Next user content preparation
 *
 * Returns the next userContent for the next iteration, or null if done.
 */
import { IntentType, IntentStatus } from "@jabberwock/types"

export async function executeTools(
	taskId: string,
	assistantMessage: string,
): Promise<Anthropic.Messages.ContentBlockParam[] | null> {
	const task = getRegisteredTask(taskId)!
	const delegate = task as ITaskModel & TaskDelegate
	const store = getBackendRootStore()

	const hasTextContent = assistantMessage.length > 0
	const assistantMsgContentFinal = delegate.assistantMessageContent
	const hasToolUses = assistantMsgContentFinal.some(
		(block: AssistantMessageContent) => block.type === "tool_use" || block.type === "mcp_tool_use",
	)

	if (hasTextContent || hasToolUses) {
		// Wait for tool execution and prepare next content
		const nextUserContent = await waitForToolExecutionAndPrepareNextContent(task, assistantMessage)

		if (nextUserContent) {
			// Create a UserMessageReceived intent for the next iteration.
			// Pass the content blocks directly so the handler can use them
			// without reading from the notification cursor.
			store.intentStore.createIntent({
				id: crypto.randomUUID(),
				type: IntentType.UserMessageReceived,
				payload: {
					taskId,
					content: nextUserContent,
				},
				status: IntentStatus.Queued,
				createdAt: Date.now(),
			})

			// Add periodic yielding to prevent blocking
			await new Promise((resolve) => setImmediate(resolve))
		}

		return nextUserContent
	}

	// No assistant responses — empty response from API
	task._state.setConsecutiveNoAssistantMessagesCount(task._state.consecutiveNoAssistantMessagesCount + 1)

	if (task._state.consecutiveNoAssistantMessagesCount >= 2) {
		await systemBroadcast(task.taskId, "error", "MODEL_NO_ASSISTANT_MESSAGES")
	}

	// Remove the user message we added earlier to avoid consecutive user messages
	const apiHistory = store.chat.tasks.get(taskId)!.apiConversationHistory
	if (apiHistory.length > 0) {
		const lastMessage = apiHistory[apiHistory.length - 1]
		if (lastMessage.role === "user") {
			store.chat.tasks.get(taskId)!.apiConversationHistory.pop()
		}
	}

	const { response } = await ask(
		task.taskId,
		"api_req_failed",
		"The model returned no assistant messages. This may indicate an issue with the API or the model's output.",
	)

	if (response === "yesButtonClicked") {
		await systemBroadcast(task.taskId, "api_req_retried")
		// Create a UserMessageReceived intent for retry instead of calling continuePipeline
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: IntentType.UserMessageReceived,
			payload: { taskId, text: "", images: [] },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	} else {
		await addToApiConversationHistory(task.taskId, task.globalStoragePath, task, {
			role: "user",
			content: [{ type: "text" as const, text: "" }],
		})
		await systemBroadcast(
			task.taskId,
			"error",
			"Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
		)
		await addToApiConversationHistory(task.taskId, task.globalStoragePath, task, {
			role: "assistant",
			content: [{ type: "text", text: "Failure: I did not provide a response." }],
		})
	}

	return null
}
