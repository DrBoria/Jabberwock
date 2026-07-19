import { Anthropic } from "@anthropic-ai/sdk"
import { Message, processUserArrayContent, processUserStringContent } from "./format-utils"
import {
	DeepSeekAssistantMessage,
	processAssistantArrayContent,
	processAssistantStringContent,
} from "./format-assistant"

type AnthropicMessage = Anthropic.Messages.MessageParam

/**
 * DeepSeek API requires that tool messages immediately follow their corresponding
 * assistant message with tool_calls. Any user messages (like environment_details
 * injected by prepareApiRequest) that appear between assistant.tool_calls and
 * tool messages must be reordered to come after the tool responses.
 */
function messageHasContent(content: Message["content"]): boolean {
	return content !== null && content !== undefined && (typeof content !== "string" || content.length > 0)
}

function isToolCallAssistantMessage(msg: Message): msg is Message & {
	role: "assistant"
	tool_calls: Array<{ id: string }>
} {
	return msg.role === "assistant" && "tool_calls" in msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0
}

function isMatchingToolResult(msg: Message, toolCallIds: Set<string>): boolean {
	return msg.role === "tool" && "tool_call_id" in msg && toolCallIds.has(msg.tool_call_id as string)
}

interface CollectPostAssistantResult {
	matchedTools: Message[]
	pendingUsers: Message[]
	nextIndex: number
}

function collectPostAssistantMessages(
	messages: Message[],
	startIndex: number,
	toolCallIds: Set<string>,
): CollectPostAssistantResult {
	let i = startIndex
	const pendingUsers: Message[] = []
	const matchedTools: Message[] = []

	while (i < messages.length) {
		const next = messages[i]
		if (isMatchingToolResult(next, toolCallIds)) {
			matchedTools.push(next)
			i++
		} else if (next.role === "user") {
			pendingUsers.push(next)
			i++
		} else if (next.role === "tool") {
			// Skip non-matching tool messages (stale tool results from previous rounds
			// with different tool_call_ids). Without this, the loop breaks on the
			// first non-matching tool, leaving the current assistant without its
			// corresponding tool responses — causing DeepSeek 400 errors like:
			// "insufficient tool messages following tool_calls message"
			i++
		} else {
			break
		}
	}

	return { matchedTools, pendingUsers, nextIndex: i }
}

function reorderToolMessages(messages: Message[]): Message[] {
	const result: Message[] = []
	let i = 0

	while (i < messages.length) {
		const current = messages[i]

		if (isToolCallAssistantMessage(current)) {
			result.push(current)
			i++

			const toolCallIds = new Set(current.tool_calls.map((tc) => tc.id))
			const { matchedTools, pendingUsers, nextIndex } = collectPostAssistantMessages(messages, i, toolCallIds)
			i = nextIndex

			if (matchedTools.length === 0) {
				// No matching tool messages found for this assistant's tool_calls.
				// This occurs when stale tool results from a previous round accumulate
				// after a new assistant with different tool_call_ids (e.g., after a
				// retry). Without this guard, the assistant would be sent with dangling
				// tool_calls, causing DeepSeek 400 error:
				// "An assistant message with 'tool_calls' must be followed by tool
				// messages responding to each 'tool_call_id'."
				// If the assistant has text content, strip `tool_calls` and keep as a
				// text-only response so the model continues generating without attempting
				// to call tools. If there is no content, remove the assistant entirely to
				// avoid sending an empty message (DeepSeek rejects `content: null`
				// without `tool_calls` as "Invalid assistant message").
				const { tool_calls: _, ...textOnlyAssistant } = current
				if (messageHasContent(current.content)) {
					result[result.length - 1] = textOnlyAssistant as Message
				} else {
					result.pop()
				}
			}

			result.push(...matchedTools)
			result.push(...pendingUsers)
		} else {
			result.push(current)
			i++
		}
	}

	return result
}

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

	return reorderToolMessages(result)
}

export type { DeepSeekAssistantMessage }
