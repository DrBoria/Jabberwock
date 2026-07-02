import { Anthropic } from "@anthropic-ai/sdk"
import { Message, processUserArrayContent, processUserStringContent } from "./format-utils"
import {
	DeepSeekAssistantMessage,
	processAssistantArrayContent,
	processAssistantStringContent,
} from "./format-assistant"

type AnthropicMessage = Anthropic.Messages.MessageParam

/**
 * Converts Anthropic messages to OpenAI format while merging consecutive messages with the same role.
 * This is required for DeepSeek Reasoner which does not support successive messages with the same role.
 *
 * For DeepSeek's interleaved thinking mode:
 * - Preserves reasoning_content on assistant messages for tool call continuations
 * - Tool result messages are converted to OpenAI tool messages
 * - reasoning_content from previous assistant messages is preserved until a new user turn
 * - Text content after tool_results (like environment_details) is merged into the last tool message
 *   to avoid creating user messages that would cause reasoning_content to be dropped
 *
 * @param messages Array of Anthropic messages
 * @param options Optional configuration for message conversion
 * @param options.mergeToolResultText If true, merge text content after tool_results into the last
 *                                     tool message instead of creating a separate user message.
 *                                     This is critical for DeepSeek's interleaved thinking mode.
 * @returns Array of OpenAI messages where consecutive messages with the same role are combined
 */
export function convertToR1Format(
	messages: AnthropicMessage[],
	options?: { mergeToolResultText?: boolean },
): Message[] {
	const result: Message[] = []

	for (const message of messages) {
		const messageWithReasoning = message as AnthropicMessage & { reasoning_content?: string }
		const reasoningContent = messageWithReasoning.reasoning_content

		if (message.role === "user") {
			if (Array.isArray(message.content)) {
				processUserArrayContent(message.content, options?.mergeToolResultText, result)
			} else {
				processUserStringContent(message.content, result)
			}
		} else if (message.role === "assistant") {
			if (Array.isArray(message.content)) {
				processAssistantArrayContent(message.content, reasoningContent, result)
			} else {
				processAssistantStringContent(message.content, reasoningContent, result)
			}
		}
	}

	return result
}

export type { DeepSeekAssistantMessage }
