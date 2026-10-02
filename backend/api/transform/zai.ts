import { Anthropic } from "@anthropic-ai/sdk"
import {
	type AssistantMessage,
	type Message,
	processAssistantArrayContent,
	processAssistantStringContent,
	processUserArrayContent,
	processUserStringContent,
} from "@api/transform/shared"

type AnthropicMessage = Anthropic.Messages.MessageParam

/**
 * Extended assistant message type to support Z.ai's interleaved thinking.
 * Z.ai's API returns reasoning_content alongside content and tool_calls,
 * and requires it to be passed back in subsequent requests for preserved thinking.
 */
type ZAiAssistantMessage = AssistantMessage & {
	reasoning_content?: string
}

/**
 * Converts Anthropic messages to OpenAI format optimized for Z.ai's GLM-4.7 thinking mode.
 *
 * Key differences from "standard" OpenAI format:
 * - Preserves reasoning_content on assistant messages for interleaved thinking
 * - Text content after tool_results (like environment_details) is merged into the last tool message
 *   to avoid creating user messages that would cause reasoning_content to be dropped
 *
 * @param messages Array of Anthropic messages
 * @param options Optional configuration for message conversion
 * @param options.mergeToolResultText If true, merge text content after tool_results into the last
 *                                     tool message instead of creating a separate user message.
 *                                     This is critical for Z.ai's interleaved thinking mode.
 * @returns Array of OpenAI messages optimized for Z.ai's thinking mode
 */
export function convertToZAiFormat(
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

export type { ZAiAssistantMessage }
