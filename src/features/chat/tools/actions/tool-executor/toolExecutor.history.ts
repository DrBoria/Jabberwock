import { Anthropic } from "@anthropic-ai/sdk"

import { getTelemetryService } from "@jabberwock/telemetry"
import { t } from "@i18n"
import type { ITaskModel } from "@features/chat/task/store"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions"
import type { ToolUse } from "@shared/tools"

import { addToApiConversationHistory } from "@features/chat/task/messages/actions/save/saveApiConversationHistory"
import { pushToolResultToUserContent } from "@features/api/handlers/helpers/process/streaming"

/**
 * Enforces new_task isolation: if new_task is called alongside other tools,
 * truncate any tools that come after it and inject error tool_results.
 * This prevents orphaned tools when delegation disposes the parent task.
 */
export function enforceNewTaskIsolation(
	task: ITaskModel,
	assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam>,
): Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> {
	const newTaskIndex = assistantContent.findIndex((block) => block.type === "tool_use" && block.name === "new_task")

	if (newTaskIndex !== -1 && newTaskIndex < assistantContent.length - 1) {
		const truncatedTools = assistantContent.slice(newTaskIndex + 1)
		assistantContent.length = newTaskIndex + 1

		const assistantMsgContent = task.assistantMessageContent
		const executionNewTaskIndex = assistantMsgContent.findIndex(
			(block: AssistantMessageContent) => block.type === "tool_use" && (block as ToolUse).name === "new_task",
		)
		if (executionNewTaskIndex !== -1) {
			task.assistantMessageContent.length = executionNewTaskIndex + 1
		}

		for (const tool of truncatedTools) {
			if (tool.type === "tool_use" && (tool as Anthropic.ToolUseBlockParam).id) {
				pushToolResultToUserContent(task.userMessageContent, {
					type: "tool_result",
					tool_use_id: (tool as Anthropic.ToolUseBlockParam).id,
					content:
						"This tool was not executed because new_task was called in the same message turn. The new_task tool must be the last tool in a message.",
					is_error: true,
				})
			}
		}
	}

	return assistantContent
}

/**
 * Saves the assistant message to API conversation history and captures telemetry.
 * This must happen BEFORE executing tools so that tool_result blocks appear
 * AFTER their corresponding tool_use blocks.
 */
export async function saveAssistantMessageToHistory(
	task: ITaskModel,
	assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam>,
	reasoningMessage: string,
): Promise<void> {
	await addToApiConversationHistory(
		task.taskId,
		task.globalStoragePath,
		task,
		{ role: "assistant", content: assistantContent } as Anthropic.MessageParam,
		reasoningMessage || undefined,
	)
	task._state.setAssistantMessageSavedToHistory(true)

	getTelemetryService().captureConversationMessage(task.taskId, "assistant")
}
