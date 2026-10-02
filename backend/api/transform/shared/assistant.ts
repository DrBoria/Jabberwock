import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"
import { Message, AssistantMessage, extractAssistantParts } from "./messages"

/**
 * Extended assistant message type to support interleaved thinking
 * (used by DeepSeek/R1 and Z.ai transforms).
 */
export type ReasoningAssistantMessage = AssistantMessage & {
	reasoning_content?: string
}

export function canMergeWithLastMessage(
	lastMessage: Message | undefined,
	toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
): boolean {
	if (!lastMessage) {
		return false
	}
	return lastMessage.role === "assistant" && toolCalls.length === 0 && !lastMessage.tool_calls
}

export function appendContentToMessage(target: Message, content: string | null, reasoning: string | undefined): void {
	if (typeof target.content === "string" && typeof content === "string") {
		target.content += `\n${content}`
		return
	}
	if (content) {
		target.content = content
	}
	if (reasoning) {
		;(target as ReasoningAssistantMessage).reasoning_content = reasoning
	}
}

export function mergeOrCreateAssistantMessage(
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
	} as ReasoningAssistantMessage)
}

export function processAssistantArrayContent(
	content: Anthropic.ContentBlockParam[],
	reasoningContent: string | undefined,
	result: Message[],
): void {
	const { textParts, toolCalls, extractedReasoning } = extractAssistantParts(content)
	const finalReasoning = reasoningContent || extractedReasoning

	mergeOrCreateAssistantMessage(result, textParts, toolCalls, finalReasoning)
}

export function processAssistantStringContent(
	content: string,
	reasoningContent: string | undefined,
	result: Message[],
): void {
	const lastMessage = result[result.length - 1]
	if (lastMessage?.role === "assistant" && !lastMessage.tool_calls) {
		if (typeof lastMessage.content === "string") {
			lastMessage.content += `\n${content}`
		} else {
			lastMessage.content = content
		}
		if (reasoningContent) {
			;(lastMessage as ReasoningAssistantMessage).reasoning_content = reasoningContent
		}
	} else {
		const assistantMessage: ReasoningAssistantMessage = {
			role: "assistant",
			content,
			...(reasoningContent && { reasoning_content: reasoningContent }),
		}
		result.push(assistantMessage)
	}
}
