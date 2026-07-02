import { Anthropic } from "@anthropic-ai/sdk"
import { AssistantMessage } from "@mistralai/mistralai/models/components/assistantmessage"
import { SystemMessage } from "@mistralai/mistralai/models/components/systemmessage"
import { ToolMessage } from "@mistralai/mistralai/models/components/toolmessage"
import { UserMessage } from "@mistralai/mistralai/models/components/usermessage"

/**
 * Normalizes a tool call ID to be compatible with Mistral's strict ID requirements.
 * Mistral requires tool call IDs to be:
 * - Only alphanumeric characters (a-z, A-Z, 0-9)
 * - Exactly 9 characters in length
 *
 * This function extracts alphanumeric characters from the original ID and
 * pads/truncates to exactly 9 characters, ensuring deterministic output.
 *
 * @param id - The original tool call ID (e.g., "call_5019f900a247472bacde0b82" or "toolu_123")
 * @returns A normalized 9-character alphanumeric ID compatible with Mistral
 */
export function normalizeMistralToolCallId(id: string): string {
	// Extract only alphanumeric characters
	const alphanumeric = id.replace(/[^a-zA-Z0-9]/g, "")

	// Take first 9 characters, or pad with zeros if shorter
	if (alphanumeric.length >= 9) {
		return alphanumeric.slice(0, 9)
	}

	// Pad with zeros to reach 9 characters
	return alphanumeric.padEnd(9, "0")
}

export type MistralMessage =
	| (SystemMessage & { role: "system" })
	| (UserMessage & { role: "user" })
	| (AssistantMessage & { role: "assistant" })
	| (ToolMessage & { role: "tool" })

// Type for Mistral tool calls in assistant messages
type MistralToolCallMessage = {
	id: string
	type: "function"
	function: {
		name: string
		arguments: string
	}
}

function extractToolResultContent(toolResult: Anthropic.ToolResultBlockParam): string {
	if (typeof toolResult.content === "string") {
		return toolResult.content
	}
	if (Array.isArray(toolResult.content)) {
		return toolResult.content
			.filter((block): block is Anthropic.TextBlockParam => block.type === "text")
			.map((block) => block.text)
			.join("\n")
	}
	return ""
}

function convertUserContent(content: Anthropic.Messages.MessageParam["content"]): MistralMessage[] {
	const messages: MistralMessage[] = []

	const { nonToolMessages, toolMessages } = (content as Anthropic.ContentBlockParam[]).reduce<{
		nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
		toolMessages: Anthropic.ToolResultBlockParam[]
	}>(
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

	if (toolMessages.length > 0) {
		for (const toolResult of toolMessages) {
			messages.push({
				role: "tool",
				toolCallId: normalizeMistralToolCallId(toolResult.tool_use_id),
				content: extractToolResultContent(toolResult),
			} as ToolMessage & { role: "tool" })
		}
	} else if (nonToolMessages.length > 0) {
		messages.push({
			role: "user",
			content: nonToolMessages.map((part) => {
				if (part.type === "image") {
					return {
						type: "image_url",
						imageUrl: {
							url: `data:${part.source.media_type};base64,${part.source.data}`,
						},
					}
				}
				return { type: "text", text: part.text }
			}),
		})
	}

	return messages
}

function convertAssistantContent(content: Anthropic.Messages.MessageParam["content"]): MistralMessage[] {
	const messages: MistralMessage[] = []

	const { nonToolMessages, toolMessages } = (content as Anthropic.ContentBlockParam[]).reduce<{
		nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
		toolMessages: Anthropic.ToolUseBlockParam[]
	}>(
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

	let textContent: string | undefined
	if (nonToolMessages.length > 0) {
		textContent = nonToolMessages
			.map((part) => {
				if (part.type === "image") {
					return ""
				}
				return part.text
			})
			.join("\n")
	}

	let toolCalls: MistralToolCallMessage[] | undefined
	if (toolMessages.length > 0) {
		toolCalls = toolMessages.map((toolUse) => ({
			id: normalizeMistralToolCallId(toolUse.id),
			type: "function" as const,
			function: {
				name: toolUse.name,
				arguments: typeof toolUse.input === "string" ? toolUse.input : JSON.stringify(toolUse.input),
			},
		}))
	}

	const assistantMessage: AssistantMessage & { role: "assistant" } = {
		role: "assistant",
		content: textContent,
	}

	if (toolCalls && toolCalls.length > 0) {
		;(
			assistantMessage as AssistantMessage & { role: "assistant"; toolCalls?: MistralToolCallMessage[] }
		).toolCalls = toolCalls
	}

	messages.push(assistantMessage)
	return messages
}

export function convertToMistralMessages(anthropicMessages: Anthropic.Messages.MessageParam[]): MistralMessage[] {
	const mistralMessages: MistralMessage[] = []

	for (const anthropicMessage of anthropicMessages) {
		if (typeof anthropicMessage.content === "string") {
			mistralMessages.push({
				role: anthropicMessage.role,
				content: anthropicMessage.content,
			})
		} else if (anthropicMessage.role === "user") {
			mistralMessages.push(...convertUserContent(anthropicMessage.content))
		} else if (anthropicMessage.role === "assistant") {
			mistralMessages.push(...convertAssistantContent(anthropicMessage.content))
		}
	}

	return mistralMessages
}
