import OpenAI from "openai"

import type { ReasoningDetail } from "@api/transform/openai-format-types"
import { consolidateReasoningDetails } from "@api/transform/content/consolidate-reasoning"

function isGeminiModel(modelId: string): boolean {
	return modelId.includes("gemini")
}

function dropAllToolCalls(
	msg: OpenAI.Chat.ChatCompletionAssistantMessageParam,
	toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
	droppedToolCallIds: Set<string>,
): OpenAI.Chat.ChatCompletionAssistantMessageParam | undefined {
	for (const tc of toolCalls) {
		if (tc.id) {
			droppedToolCallIds.add(tc.id)
		}
	}

	if (msg.content) {
		return {
			role: "assistant",
			content: msg.content,
		} as OpenAI.Chat.ChatCompletionAssistantMessageParam
	}

	return undefined
}

function filterValidToolCalls(
	toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
	reasoningDetails: ReasoningDetail[],
	droppedToolCallIds: Set<string>,
): { validToolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[]; validReasoningDetails: ReasoningDetail[] } {
	const validToolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = []
	const validReasoningDetails: ReasoningDetail[] = []

	for (const tc of toolCalls) {
		const matchingDetails = reasoningDetails.filter((d) => d.id === tc.id)

		if (matchingDetails.length > 0) {
			validToolCalls.push(tc)
			validReasoningDetails.push(...matchingDetails)
		} else if (tc.id) {
			droppedToolCallIds.add(tc.id)
		}
	}

	const detailsWithoutId = reasoningDetails.filter((d) => !d.id)
	validReasoningDetails.push(...detailsWithoutId)

	return { validToolCalls, validReasoningDetails }
}

function buildSanitizedAssistantMsg(
	msg: OpenAI.Chat.ChatCompletionAssistantMessageParam,
	validToolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
	validReasoningDetails: ReasoningDetail[],
): OpenAI.Chat.ChatCompletionAssistantMessageParam {
	const sanitizedMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam & {
		reasoning_details?: ReasoningDetail[]
	} = {
		role: "assistant",
		content: msg.content ?? "",
	}

	if (validReasoningDetails.length > 0) {
		sanitizedMsg.reasoning_details = consolidateReasoningDetails(validReasoningDetails)
	}

	if (validToolCalls.length > 0) {
		sanitizedMsg.tool_calls = validToolCalls
	}

	return sanitizedMsg
}

function processAssistantToolMessage(
	msg: OpenAI.Chat.ChatCompletionMessageParam,
	droppedToolCallIds: Set<string>,
	sanitized: OpenAI.Chat.ChatCompletionMessageParam[],
): boolean {
	const assistantMsg = msg as OpenAI.Chat.ChatCompletionAssistantMessageParam
	const toolCalls = assistantMsg.tool_calls
	const reasoningDetails = (msg as { reasoning_details?: ReasoningDetail[] }).reasoning_details

	if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
		return false
	}

	const hasReasoningDetails = Array.isArray(reasoningDetails) && reasoningDetails.length > 0

	if (!hasReasoningDetails) {
		const result = dropAllToolCalls(assistantMsg, toolCalls, droppedToolCallIds)
		if (result) {
			sanitized.push(result)
		}
		return true
	}

	const { validToolCalls, validReasoningDetails } = filterValidToolCalls(
		toolCalls,
		reasoningDetails,
		droppedToolCallIds,
	)
	sanitized.push(buildSanitizedAssistantMsg(assistantMsg, validToolCalls, validReasoningDetails))
	return true
}

function shouldDropToolResult(msg: OpenAI.Chat.ChatCompletionMessageParam, droppedToolCallIds: Set<string>): boolean {
	if (msg.role !== "tool") {
		return false
	}
	const toolMsg = msg as OpenAI.Chat.ChatCompletionToolMessageParam
	return !!(toolMsg.tool_call_id && droppedToolCallIds.has(toolMsg.tool_call_id))
}

/**
 * Sanitizes OpenAI messages for Gemini models by filtering reasoning_details
 * to only include entries that match the tool call IDs.
 *
 * Gemini models require thought signatures for tool calls. When switching providers
 * mid-conversation, historical tool calls may not include Gemini reasoning details,
 * which can poison the next request. This function:
 * 1. Filters reasoning_details to only include entries matching tool call IDs
 * 2. Drops tool_calls that lack any matching reasoning_details
 * 3. Removes corresponding tool result messages for dropped tool calls
 *
 * @param messages - Array of OpenAI chat completion messages
 * @param modelId - The model ID to check if sanitization is needed
 * @returns Sanitized array of messages (unchanged if not a Gemini model)
 * @see https://github.com/cline/cline/issues/8214
 */
export function sanitizeGeminiMessages(
	messages: OpenAI.Chat.ChatCompletionMessageParam[],
	modelId: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
	if (!isGeminiModel(modelId)) {
		return messages
	}

	const droppedToolCallIds = new Set<string>()
	const sanitized: OpenAI.Chat.ChatCompletionMessageParam[] = []

	for (const msg of messages) {
		if (processAssistantToolMessage(msg, droppedToolCallIds, sanitized)) {
			continue
		}

		if (shouldDropToolResult(msg, droppedToolCallIds)) {
			continue
		}

		sanitized.push(msg)
	}

	return sanitized
}
