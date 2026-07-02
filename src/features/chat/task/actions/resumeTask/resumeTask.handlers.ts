import { Anthropic } from "@anthropic-ai/sdk"

import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"

export interface ResumeHandlerResult {
	history: ApiMessage[]
	oldContent: Anthropic.Messages.ContentBlockParam[]
}

function asContentBlocks(message: { content?: string | unknown[] }): Anthropic.Messages.ContentBlockParam[] {
	if (Array.isArray(message.content)) {
		return message.content as Anthropic.Messages.ContentBlockParam[]
	}
	return [{ type: "text" as const, text: (message.content as string) ?? "" }]
}

function createInterruptedToolResponses(
	content: Anthropic.Messages.ContentBlockParam[],
): Anthropic.ToolResultBlockParam[] {
	const toolUseBlocks = content.filter((b) => b.type === "tool_use") as Anthropic.Messages.ToolUseBlock[]
	return toolUseBlocks.map((toolUse) => ({
		type: "tool_result" as const,
		tool_use_id: toolUse.id,
		content: "Task was interrupted before this tool call could be completed.",
	}))
}

export function handleSummary(lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
	const summary = lastMessage.summary as Anthropic.Messages.ContentBlockParam[] | undefined
	return {
		history: history.slice(0, -1),
		oldContent: summary ? [...summary] : [],
	}
}

export function handleAssistantWithTools(lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
	const content = asContentBlocks(lastMessage)
	const toolResponses = createInterruptedToolResponses(content)
	return {
		history: [...history],
		oldContent: [
			{
				type: "text" as const,
				text: "I need to resume the task. Please continue with the task based on the current state.",
			},
			...toolResponses,
		],
	}
}

export function handleAssistantNoTools(_lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
	return { history: [...history], oldContent: [] }
}

export function handleUserWithMissingTools(lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
	const previousAssistantMessage = history[history.length - 2]
	const userContent = asContentBlocks(lastMessage)

	const assistantContent = asContentBlocks(previousAssistantMessage)
	const toolUseBlocks = assistantContent.filter((b) => b.type === "tool_use") as Anthropic.Messages.ToolUseBlock[]

	const existingToolResults = userContent.filter((b) => b.type === "tool_result") as Anthropic.ToolResultBlockParam[]

	const existingToolIds = new Set(existingToolResults.map((r) => r.tool_use_id))
	const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
		.filter((toolUse) => !existingToolIds.has(toolUse.id))
		.map((toolUse) => ({
			type: "tool_result",
			tool_use_id: toolUse.id,
			content: "Task was interrupted before this tool call could be completed.",
		}))

	return {
		history: history.slice(0, -1),
		oldContent: [...userContent, ...missingToolResponses],
	}
}

export function handleUserNoTools(lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
	return {
		history: history.slice(0, -1),
		oldContent: [...asContentBlocks(lastMessage)],
	}
}
