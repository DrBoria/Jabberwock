import type { Anthropic } from "@anthropic-ai/sdk"

import { sanitizeOpenAiCallId } from "@utils/mcp"

import type { ResponsesRequestBody } from "./types"

export function formatUserMessage(message: Anthropic.Messages.MessageParam): ResponsesRequestBody["input"] {
	const content: Record<string, unknown>[] = []
	const toolResults: Record<string, unknown>[] = []

	if (typeof message.content === "string") {
		content.push({ type: "input_text", text: message.content })
		return buildUserResult(content, toolResults)
	}
	if (!Array.isArray(message.content)) {
		return buildUserResult(content, toolResults)
	}
	for (const block of message.content) {
		if (block.type === "text") {
			content.push({ type: "input_text", text: block.text })
		} else if (block.type === "image") {
			const image = block as Anthropic.Messages.ImageBlockParam
			const imageUrl = `data:${image.source.media_type};base64,${image.source.data}`
			content.push({ type: "input_image", image_url: imageUrl })
		} else if (block.type === "tool_result") {
			const result =
				typeof block.content === "string"
					? block.content
					: block.content?.map((c) => (c.type === "text" ? c.text : "")).join("") || ""
			toolResults.push({
				type: "function_call_output",
				call_id: sanitizeOpenAiCallId(block.tool_use_id),
				output: result,
			})
		}
	}

	return buildUserResult(content, toolResults)
}

function buildUserResult(
	content: Record<string, unknown>[],
	toolResults: Record<string, unknown>[],
): ResponsesRequestBody["input"] {
	const result: ResponsesRequestBody["input"] = []
	if (content.length > 0) {
		result.push({ role: "user", content })
	}
	for (const tr of toolResults) {
		result.push(tr as (typeof result)[number])
	}
	return result
}

export function formatAssistantMessage(message: Anthropic.Messages.MessageParam): ResponsesRequestBody["input"] {
	const content: Record<string, unknown>[] = []
	const toolCalls: Record<string, unknown>[] = []

	if (typeof message.content === "string") {
		content.push({ type: "output_text", text: message.content })
		return buildAssistantResult(content, toolCalls)
	}
	if (!Array.isArray(message.content)) {
		return buildAssistantResult(content, toolCalls)
	}
	for (const block of message.content) {
		if (block.type === "text") {
			content.push({ type: "output_text", text: block.text })
		} else if (block.type === "tool_use") {
			toolCalls.push({
				type: "function_call",
				call_id: sanitizeOpenAiCallId(block.id),
				name: block.name,
				arguments: JSON.stringify(block.input),
			})
		}
	}

	return buildAssistantResult(content, toolCalls)
}

function buildAssistantResult(
	content: Record<string, unknown>[],
	toolCalls: Record<string, unknown>[],
): ResponsesRequestBody["input"] {
	const result: ResponsesRequestBody["input"] = []
	if (content.length > 0) {
		result.push({ role: "assistant", content })
	}
	for (const tc of toolCalls) {
		result.push(tc as (typeof result)[number])
	}
	return result
}

export function formatFullConversation(
	systemPrompt: string,
	messages: Anthropic.Messages.MessageParam[],
): ResponsesRequestBody["input"] {
	const formattedInput: ResponsesRequestBody["input"] = []

	for (const message of messages) {
		const extendedMsg = message as Anthropic.Messages.MessageParam & { type?: string }
		if (extendedMsg.type === "reasoning") {
			formattedInput.push(extendedMsg as (typeof formattedInput)[number])
			continue
		}

		if (message.role === "user") {
			const parts = formatUserMessage(message)
			formattedInput.push(...parts)
		} else if (message.role === "assistant") {
			const parts = formatAssistantMessage(message)
			formattedInput.push(...parts)
		}
	}

	return formattedInput
}
