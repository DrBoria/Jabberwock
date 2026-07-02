import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

type ContentPartText = OpenAI.Chat.ChatCompletionContentPartText
type ContentPartImage = OpenAI.Chat.ChatCompletionContentPartImage
type UserMessage = OpenAI.Chat.ChatCompletionUserMessageParam
type AssistantMessage = OpenAI.Chat.ChatCompletionAssistantMessageParam
type ToolMessage = OpenAI.Chat.ChatCompletionToolMessageParam
type Message = OpenAI.Chat.ChatCompletionMessageParam

type UserContentPart = {
	textParts: string[]
	imageParts: ContentPartImage[]
	toolResults: { tool_use_id: string; content: string }[]
}

function extractUserParts(content: Anthropic.ContentBlockParam[]): UserContentPart {
	const textParts: string[] = []
	const imageParts: ContentPartImage[] = []
	const toolResults: { tool_use_id: string; content: string }[] = []

	for (const part of content) {
		if (part.type === "text") {
			textParts.push(part.text)
		} else if (part.type === "image") {
			imageParts.push({
				type: "image_url",
				image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
			})
		} else if (part.type === "tool_result") {
			let contentStr: string
			if (typeof part.content === "string") {
				contentStr = part.content
			} else if (Array.isArray(part.content)) {
				contentStr =
					part.content
						?.map((c) => {
							if (c.type === "text") return c.text
							if (c.type === "image") return "(image)"
							return ""
						})
						.join("\n") ?? ""
			} else {
				contentStr = ""
			}
			toolResults.push({
				tool_use_id: part.tool_use_id,
				content: contentStr,
			})
		}
	}

	return { textParts, imageParts, toolResults }
}

function addToolResults(toolResults: { tool_use_id: string; content: string }[], result: Message[]): void {
	for (const toolResult of toolResults) {
		const toolMessage: ToolMessage = {
			role: "tool",
			tool_call_id: toolResult.tool_use_id,
			content: toolResult.content,
		}
		result.push(toolMessage)
	}
}

function buildUserContent(textParts: string[], imageParts: ContentPartImage[]): UserMessage["content"] {
	if (imageParts.length > 0) {
		const parts: (ContentPartText | ContentPartImage)[] = []
		if (textParts.length > 0) {
			parts.push({ type: "text", text: textParts.join("\n") })
		}
		parts.push(...imageParts)
		return parts
	}
	return textParts.join("\n")
}

function mergeContentIntoLastUserMessage(result: Message[], content: UserMessage["content"]): void {
	const lastMessage = result[result.length - 1]
	if (lastMessage?.role !== "user") {
		result.push({ role: "user", content })
		return
	}

	if (typeof lastMessage.content === "string" && typeof content === "string") {
		lastMessage.content += `\n${content}`
	} else {
		const lastContent = Array.isArray(lastMessage.content)
			? lastMessage.content
			: [{ type: "text" as const, text: lastMessage.content || "" }]
		const newContent = Array.isArray(content) ? content : [{ type: "text" as const, text: content }]
		lastMessage.content = [...lastContent, ...newContent] as UserMessage["content"]
	}
}

function processNonToolContent(
	textParts: string[],
	imageParts: ContentPartImage[],
	toolResultsCount: number,
	mergeToolResultText: boolean | undefined,
	result: Message[],
): void {
	if (textParts.length === 0 && imageParts.length === 0) {
		return
	}

	const shouldMergeIntoToolMessage = mergeToolResultText && toolResultsCount > 0 && imageParts.length === 0

	if (shouldMergeIntoToolMessage) {
		const lastToolMessage = result[result.length - 1] as ToolMessage
		if (lastToolMessage?.role === "tool") {
			const additionalText = textParts.join("\n")
			lastToolMessage.content = `${lastToolMessage.content}\n\n${additionalText}`
		}
	} else {
		const content = buildUserContent(textParts, imageParts)
		mergeContentIntoLastUserMessage(result, content)
	}
}

function processUserArrayContent(
	content: Anthropic.ContentBlockParam[],
	mergeToolResultText: boolean | undefined,
	result: Message[],
): void {
	const { textParts, imageParts, toolResults } = extractUserParts(content)

	addToolResults(toolResults, result)
	processNonToolContent(textParts, imageParts, toolResults.length, mergeToolResultText, result)
}

function processUserStringContent(content: string, result: Message[]): void {
	mergeContentIntoLastUserMessage(result, content)
}

type AssistantContentPart = {
	textParts: string[]
	toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[]
	extractedReasoning: string | undefined
}

function extractAssistantParts(content: Anthropic.ContentBlockParam[]): AssistantContentPart {
	const textParts: string[] = []
	const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = []
	let extractedReasoning: string | undefined

	for (const part of content) {
		if (part.type === "text") {
			textParts.push(part.text)
		} else if (part.type === "tool_use") {
			toolCalls.push({
				id: part.id,
				type: "function",
				function: {
					name: part.name,
					arguments: JSON.stringify(part.input),
				},
			})
		} else if (
			(part as { type: string; text?: string }).type === "reasoning" &&
			(part as { type: string; text?: string }).text
		) {
			extractedReasoning = (part as { type: string; text?: string }).text
		}
	}

	return { textParts, toolCalls, extractedReasoning }
}

export type { Message, UserMessage, AssistantMessage, UserContentPart, ContentPartImage, ContentPartText }
export {
	extractUserParts,
	addToolResults,
	buildUserContent,
	mergeContentIntoLastUserMessage,
	processNonToolContent,
	processUserArrayContent,
	processUserStringContent,
	extractAssistantParts,
}
