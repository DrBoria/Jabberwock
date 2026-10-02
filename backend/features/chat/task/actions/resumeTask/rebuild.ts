import { Anthropic } from "@anthropic-ai/sdk"

import type { ApiMessage } from "@features/chat"

export interface ResumeHandlerResult {
	history: ApiMessage[]
	oldContent: Anthropic.Messages.ContentBlockParam[]
}

/**
 * Normalizes a message's `content` into a list of Anthropic content blocks,
 * wrapping a plain string in a single text block.
 */
export function asContentBlocks(message: { content?: string | unknown[] }): Anthropic.Messages.ContentBlockParam[] {
	if (Array.isArray(message.content)) {
		return message.content as Anthropic.Messages.ContentBlockParam[]
	}
	return [{ type: "text" as const, text: (message.content as string) ?? "" }]
}

/**
 * Returns the content blocks of the assistant message immediately before the
 * last message in `history`, or an empty list when there is no such message.
 * Shared by the handler-key resolver and the missing-tools handler.
 */
export function previousAssistantContent(history: ApiMessage[]): Anthropic.Messages.ContentBlockParam[] {
	const previousAssistantMessage = history[history.length - 2]
	if (!previousAssistantMessage || previousAssistantMessage.role !== "assistant") {
		return []
	}
	return asContentBlocks(previousAssistantMessage)
}

/**
 * Builds the tool_result block that stands in for a tool call interrupted
 * before it could complete. Shared by every resume handler that has to
 * reconcile missing tool results.
 */
export function interruptedToolResult(toolUseId: string): Anthropic.ToolResultBlockParam {
	return {
		type: "tool_result" as const,
		tool_use_id: toolUseId,
		content: "Task was interrupted before this tool call could be completed.",
	}
}

function createInterruptedToolResponses(
	content: Anthropic.Messages.ContentBlockParam[],
): Anthropic.ToolResultBlockParam[] {
	const toolUseBlocks = content.filter((b) => b.type === "tool_use") as Anthropic.Messages.ToolUseBlock[]
	return toolUseBlocks.map((toolUse) => interruptedToolResult(toolUse.id))
}

export function classifySummary(lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
	const summary = lastMessage.summary as Anthropic.Messages.ContentBlockParam[] | undefined
	return {
		history: history.slice(0, -1),
		oldContent: summary ? [...summary] : [],
	}
}

export function classifyAssistantWithTools(lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
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

export function classifyAssistantNoTools(_lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
	return { history: [...history], oldContent: [] }
}

export function classifyUserWithMissingTools(lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
	const userContent = asContentBlocks(lastMessage)

	const assistantContent = previousAssistantContent(history)
	const toolUseBlocks = assistantContent.filter((b) => b.type === "tool_use") as Anthropic.Messages.ToolUseBlock[]

	const existingToolResults = userContent.filter((b) => b.type === "tool_result") as Anthropic.ToolResultBlockParam[]

	const existingToolIds = new Set(existingToolResults.map((r) => r.tool_use_id))
	const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
		.filter((toolUse) => !existingToolIds.has(toolUse.id))
		.map((toolUse) => interruptedToolResult(toolUse.id))

	return {
		history: history.slice(0, -1),
		oldContent: [...userContent, ...missingToolResponses],
	}
}

export function classifyUserNoTools(lastMessage: ApiMessage, history: ApiMessage[]): ResumeHandlerResult {
	return {
		history: history.slice(0, -1),
		oldContent: [...asContentBlocks(lastMessage)],
	}
}
