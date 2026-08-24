/**
 * AI SDK conversion utilities for transforming between Anthropic/OpenAI formats and Vercel AI SDK formats.
 * These utilities are designed to be reused across different AI SDK providers.
 */

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { tool as createTool, jsonSchema, type ModelMessage } from "ai"

function buildToolCallIdMap(messages: Anthropic.Messages.MessageParam[]): Map<string, string> {
	const map = new Map<string, string>()
	for (const message of messages) {
		if (message.role === "assistant" && typeof message.content !== "string") {
			for (const part of message.content) {
				if (part.type === "tool_use") {
					map.set(part.id, part.name)
				}
			}
		}
	}
	return map
}

type UserContentPart = { type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }

type ToolResultPart = {
	type: "tool-result"
	toolCallId: string
	toolName: string
	output: { type: "text"; value: string }
}

function convertImageBlock(part: Anthropic.ContentBlockParam & { type: "image" }): UserContentPart | undefined {
	const source = part.source as { type: string; media_type?: string; data?: string; url?: string }
	if (source.type === "base64" && source.media_type && source.data) {
		return {
			type: "image",
			image: `data:${source.media_type};base64,${source.data}`,
			mimeType: source.media_type,
		}
	}
	if (source.type === "url" && source.url) {
		return {
			type: "image",
			image: source.url,
		}
	}
	return undefined
}

function blockToText(block: Anthropic.TextBlockParam | Anthropic.ImageBlockParam): string {
	if (block.type === "text") return block.text
	if (block.type === "image") return "(image)"
	return ""
}

function extractToolResultText(part: Anthropic.ToolResultBlockParam): string {
	if (typeof part.content === "string") {
		return part.content
	}
	const text = part.content?.map(blockToText).join("\n") ?? ""
	return text || "(empty)"
}

function buildToolResultPart(
	part: Anthropic.ToolResultBlockParam,
	toolCallIdToName: Map<string, string>,
): ToolResultPart {
	const content = extractToolResultText(part)
	const toolName = toolCallIdToName.get(part.tool_use_id) ?? "unknown_tool"
	return {
		type: "tool-result",
		toolCallId: part.tool_use_id,
		toolName,
		output: { type: "text", value: content },
	}
}

function processUserContent(
	content: Anthropic.ContentBlockParam[],
	toolCallIdToName: Map<string, string>,
	result: ModelMessage[],
): void {
	const parts: UserContentPart[] = []
	const toolResults: ToolResultPart[] = []

	for (const part of content) {
		if (part.type === "text") {
			parts.push({ type: "text", text: part.text })
		} else if (part.type === "image") {
			const imagePart = convertImageBlock(part)
			if (imagePart) {
				parts.push(imagePart)
			}
		} else if (part.type === "tool_result") {
			toolResults.push(buildToolResultPart(part, toolCallIdToName))
		}
	}

	if (toolResults.length > 0) {
		result.push({ role: "tool", content: toolResults } as ModelMessage)
	}
	if (parts.length > 0) {
		result.push({ role: "user", content: parts } as ModelMessage)
	}
}

type ToolCallPart = {
	type: "tool-call"
	toolCallId: string
	toolName: string
	input: unknown
}

function processAssistantContent(content: Anthropic.ContentBlockParam[], result: ModelMessage[]): void {
	const textParts: string[] = []
	const toolCalls: ToolCallPart[] = []

	for (const part of content) {
		if (part.type === "text") {
			textParts.push(part.text)
		} else if (part.type === "tool_use") {
			toolCalls.push({
				type: "tool-call",
				toolCallId: part.id,
				toolName: part.name,
				input: part.input,
			})
		}
	}

	const contentArray: Array<{ type: "text"; text: string } | ToolCallPart> = []

	if (textParts.length > 0) {
		contentArray.push({ type: "text", text: textParts.join("\n") })
	}
	contentArray.push(...toolCalls)

	result.push({
		role: "assistant",
		content: contentArray.length > 0 ? contentArray : [{ type: "text", text: "" }],
	} as ModelMessage)
}

/**
 * Convert Anthropic messages to AI SDK ModelMessage format.
 * Handles text, images, tool uses, and tool results.
 *
 * @param messages - Array of Anthropic message parameters
 * @returns Array of AI SDK ModelMessage objects
 */
export function convertToAiSdkMessages(messages: Anthropic.Messages.MessageParam[]): ModelMessage[] {
	const modelMessages: ModelMessage[] = []
	const toolCallIdToName = buildToolCallIdMap(messages)

	for (const message of messages) {
		if (typeof message.content === "string") {
			modelMessages.push({ role: message.role, content: message.content })
			continue
		}
		if (message.role === "user") {
			processUserContent(message.content, toolCallIdToName, modelMessages)
		} else if (message.role === "assistant") {
			processAssistantContent(message.content, modelMessages)
		}
	}

	return modelMessages
}

/**
 * Convert OpenAI-style function tool definitions to AI SDK tool format.
 *
 * @param tools - Array of OpenAI tool definitions
 * @returns Record of AI SDK tools keyed by tool name, or undefined if no tools
 */
export function convertToolsForAiSdk(
	tools: OpenAI.Chat.ChatCompletionTool[] | undefined,
): Record<string, ReturnType<typeof createTool>> | undefined {
	if (!tools || tools.length === 0) {
		return undefined
	}

	const toolSet: Record<string, ReturnType<typeof createTool>> = {}

	for (const t of tools) {
		if (t.type === "function") {
			toolSet[t.function.name] = createTool({
				description: t.function.description,
				inputSchema: jsonSchema(t.function.parameters as Record<string, unknown>),
			})
		}
	}

	return toolSet
}
