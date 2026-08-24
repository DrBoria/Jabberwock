import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type {
	ReasoningDetail,
	AnthropicMessageWithReasoning,
	ContentSplitResult,
	ToolCallSplitResult,
} from "@api/transform/openai-format-types"

export function mapReasoningDetails(details: unknown): ReasoningDetail[] | undefined {
	if (!Array.isArray(details)) {
		return undefined
	}

	return details.map((detail: ReasoningDetail) => {
		if (detail?.format === "openai-responses-v1" && detail?.id) {
			const { id: _, ...rest } = detail
			return rest as ReasoningDetail
		}
		return detail
	})
}

export function splitUserContent(content: Anthropic.ContentBlockParam[]): ContentSplitResult {
	return content.reduce<ContentSplitResult>(
		(acc, part) => {
			if (part.type === "tool_result") {
				acc.toolMessages.push(part)
			} else if (part.type === "text" || part.type === "image") {
				acc.nonToolMessages.push(part)
			}
			return acc
		},
		{ nonToolMessages: [], toolMessages: [] },
	)
}

export function splitAssistantContent(content: Anthropic.ContentBlockParam[]): ToolCallSplitResult {
	return content.reduce<ToolCallSplitResult>(
		(acc, part) => {
			if (part.type === "tool_use") {
				acc.toolMessages.push(part)
			} else if (part.type === "text" || part.type === "image") {
				acc.nonToolMessages.push(part)
			}
			return acc
		},
		{ nonToolMessages: [], toolMessages: [] },
	)
}

export function convertToolResultToString(toolMessage: Anthropic.ToolResultBlockParam): string {
	if (typeof toolMessage.content === "string") {
		return toolMessage.content
	}

	return toolMessage.content?.map((part) => (part.type === "text" ? part.text : "")).join("\n") ?? ""
}

export function processUserToolMessages(
	toolMessages: Anthropic.ToolResultBlockParam[],
	normalizeId: (id: string) => string,
	openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
): void {
	for (const toolMessage of toolMessages) {
		const content = convertToolResultToString(toolMessage)
		openAiMessages.push({
			role: "tool",
			tool_call_id: normalizeId(toolMessage.tool_use_id),
			content: content || "(empty)",
		})
	}
}

export function processUserNonToolMessages(
	filteredNonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[],
	hasToolMessages: boolean,
	mergeToolResultText: boolean | undefined,
	openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
): void {
	if (filteredNonToolMessages.length === 0) {
		return
	}

	const hasOnlyTextContent = filteredNonToolMessages.every((part) => part.type === "text")
	const shouldMerge = mergeToolResultText && hasToolMessages && hasOnlyTextContent

	if (shouldMerge) {
		const lastToolMessage = openAiMessages[openAiMessages.length - 1] as OpenAI.Chat.ChatCompletionToolMessageParam
		if (lastToolMessage?.role === "tool") {
			const additionalText = filteredNonToolMessages
				.map((part) => (part as Anthropic.TextBlockParam).text)
				.join("\n")
			lastToolMessage.content = `${lastToolMessage.content}\n\n${additionalText}`
		}
	} else {
		openAiMessages.push({
			role: "user",
			content: filteredNonToolMessages.map((part) => {
				if (part.type === "image") {
					return {
						type: "image_url",
						image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
					}
				}
				return { type: "text", text: part.text }
			}),
		})
	}
}

export function processStringContent(
	content: string,
	role: "user" | "assistant",
	reasoningDetails?: ReasoningDetail[],
): OpenAI.Chat.ChatCompletionMessageParam {
	const baseMessage: OpenAI.Chat.ChatCompletionMessageParam & { reasoning_details?: ReasoningDetail[] } = {
		role,
		content,
	}

	if (role === "assistant") {
		const mapped = mapReasoningDetails(reasoningDetails)
		if (mapped) {
			baseMessage.reasoning_details = mapped
		}
	}

	return baseMessage
}

export function processArrayContentUser(
	content: Anthropic.ContentBlockParam[],
	normalizeId: (id: string) => string,
	mergeToolResultText: boolean | undefined,
	openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
): void {
	const { nonToolMessages, toolMessages } = splitUserContent(content)

	processUserToolMessages(toolMessages, normalizeId, openAiMessages)

	const filteredNonToolMessages = nonToolMessages.filter(
		(part) => part.type === "image" || (part.type === "text" && part.text),
	)

	processUserNonToolMessages(filteredNonToolMessages, toolMessages.length > 0, mergeToolResultText, openAiMessages)
}

export function processArrayContentAssistant(
	content: Anthropic.ContentBlockParam[],
	normalizeId: (id: string) => string,
	anthropicMessage: Anthropic.Messages.MessageParam,
	openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
): void {
	const { nonToolMessages, toolMessages } = splitAssistantContent(content)

	let contentText: string | undefined
	if (nonToolMessages.length > 0) {
		contentText = nonToolMessages
			.map((part) => {
				if (part.type === "image") {
					return ""
				}
				return part.text
			})
			.join("\n")
	}

	const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolMessages.map((toolMessage) => ({
		id: normalizeId(toolMessage.id),
		type: "function",
		function: {
			name: toolMessage.name,
			arguments: JSON.stringify(toolMessage.input),
		},
	}))

	const messageWithDetails = anthropicMessage as AnthropicMessageWithReasoning

	const baseMessage: OpenAI.Chat.ChatCompletionAssistantMessageParam & {
		reasoning_details?: ReasoningDetail[]
	} = {
		role: "assistant",
		content: contentText ?? "",
	}

	const mapped = mapReasoningDetails(messageWithDetails.reasoning_details)
	if (mapped) {
		baseMessage.reasoning_details = mapped
	}

	if (toolCalls.length > 0) {
		baseMessage.tool_calls = toolCalls
	}

	openAiMessages.push(baseMessage)
}
