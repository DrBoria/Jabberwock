import { Anthropic } from "@anthropic-ai/sdk"
import { sanitizeOpenAiCallId } from "@utils/mcp"
import type { ResponsesRequestBody } from "./types"
import { getReasoningConversationItem } from "./types"

export function formatUserMessage(
	message: Anthropic.Messages.MessageParam,
	formattedInput: ResponsesRequestBody["input"],
): void {
	const content: Record<string, unknown>[] = []
	const toolResults: Array<{ type: "function_call_output"; call_id: string; output: string }> = []

	if (typeof message.content === "string") {
		content.push({ type: "input_text", text: message.content })
	} else if (Array.isArray(message.content)) {
		for (const block of message.content) {
			formatUserContentBlock(block, content, toolResults)
		}
	}

	if (content.length > 0) {
		formattedInput.push({ role: "user", content })
	}

	for (const tr of toolResults) {
		formattedInput.push(tr)
	}
}

function formatUserContentBlock(
	block: Anthropic.Messages.ContentBlockParam,
	content: Record<string, unknown>[],
	toolResults: Array<{ type: "function_call_output"; call_id: string; output: string }>,
): void {
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

export function formatAssistantMessage(
	message: Anthropic.Messages.MessageParam,
	formattedInput: ResponsesRequestBody["input"],
): void {
	const content: Record<string, unknown>[] = []
	const toolCalls: Array<{ type: "function_call"; call_id: string; name: string; arguments: string }> = []

	if (typeof message.content === "string") {
		content.push({ type: "output_text", text: message.content })
	} else if (Array.isArray(message.content)) {
		for (const block of message.content) {
			formatAssistantContentBlock(block, content, toolCalls)
		}
	}

	if (content.length > 0) {
		formattedInput.push({ role: "assistant", content })
	}

	for (const tc of toolCalls) {
		formattedInput.push(tc)
	}
}

function formatAssistantContentBlock(
	block: Anthropic.Messages.ContentBlockParam,
	content: Record<string, unknown>[],
	toolCalls: Array<{ type: "function_call"; call_id: string; name: string; arguments: string }>,
): void {
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

export function formatFullConversation(messages: Anthropic.Messages.MessageParam[]): ResponsesRequestBody["input"] {
	const formattedInput: ResponsesRequestBody["input"] = []

	for (const message of messages) {
		const reasoningItem = getReasoningConversationItem(message)
		if (reasoningItem) {
			formattedInput.push(reasoningItem)
			continue
		}

		if (message.role === "user") {
			formatUserMessage(message, formattedInput)
		} else if (message.role === "assistant") {
			formatAssistantMessage(message, formattedInput)
		}
	}

	return formattedInput
}
