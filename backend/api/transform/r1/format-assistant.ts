import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"
import { Message, AssistantMessage, extractAssistantParts } from "./format-utils"

/**
 * Extended assistant message type to support DeepSeek's interleaved thinking.
 */
export type DeepSeekAssistantMessage = AssistantMessage & {
	reasoning_content?: string
}

function canMergeWithLastMessage(
	lastMessage: Message | undefined,
	toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
): boolean {
	if (!lastMessage) {
		return false
	}
	return lastMessage.role === "assistant" && toolCalls.length === 0 && !lastMessage.tool_calls
}

function appendContentToMessage(target: Message, content: string | null, reasoning: string | undefined): void {
	if (typeof target.content === "string" && typeof content === "string") {
		target.content += `\n${content}`
		return
	}
	if (content) {
		target.content = content
	}
	if (reasoning) {
		;(target as DeepSeekAssistantMessage).reasoning_content = reasoning
	}
}

function mergeOrCreateAssistantMessage(
	result: Message[],
	textParts: string[],
	toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
	reasoning: string | undefined,
): void {
	const content = textParts.length > 0 ? textParts.join("\n") : null

	const lastMessage = result[result.length - 1]
	if (canMergeWithLastMessage(lastMessage, toolCalls)) {
		appendContentToMessage(lastMessage, content, reasoning)
		return
	}
	result.push({
		role: "assistant",
		content,
		...(toolCalls.length > 0 && { tool_calls: toolCalls }),
		...(reasoning && { reasoning_content: reasoning }),
	} as DeepSeekAssistantMessage)
}

function processAssistantArrayContent(
	content: Anthropic.ContentBlockParam[],
	reasoningContent: string | undefined,
	result: Message[],
): void {
	const { textParts, toolCalls, extractedReasoning } = extractAssistantParts(content)
	const finalReasoning = reasoningContent || extractedReasoning

	mergeOrCreateAssistantMessage(result, textParts, toolCalls, finalReasoning)
}

function processAssistantStringContent(content: string, reasoningContent: string | undefined, result: Message[]): void {
	const lastMessage = result[result.length - 1]
	if (lastMessage?.role === "assistant" && !lastMessage.tool_calls) {
		if (typeof lastMessage.content === "string") {
			lastMessage.content += `\n${content}`
		} else {
			lastMessage.content = content
		}
		if (reasoningContent) {
			;(lastMessage as DeepSeekAssistantMessage).reasoning_content = reasoningContent
		}
	} else {
		const assistantMessage: DeepSeekAssistantMessage = {
			role: "assistant",
			content,
			...(reasoningContent && { reasoning_content: reasoningContent }),
		}
		result.push(assistantMessage)
	}
}

export {
	canMergeWithLastMessage,
	appendContentToMessage,
	mergeOrCreateAssistantMessage,
	processAssistantArrayContent,
	processAssistantStringContent,
}
