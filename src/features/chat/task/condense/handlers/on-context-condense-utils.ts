import Anthropic from "@anthropic-ai/sdk"

import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"

export const MIN_CONDENSE_THRESHOLD = 5
export const MAX_CONDENSE_THRESHOLD = 100

export function toolUseToText(block: Anthropic.Messages.ToolUseBlockParam): string {
	let input: string
	if (typeof block.input === "object" && block.input !== null) {
		input = Object.entries(block.input)
			.map(([key, value]) => {
				const formattedValue =
					typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value)
				return `${key}: ${formattedValue}`
			})
			.join("\n")
	} else {
		input = String(block.input)
	}
	return `[Tool Use: ${block.name}]\n${input}`
}

export function toolResultToText(block: Anthropic.Messages.ToolResultBlockParam): string {
	const errorSuffix = block.is_error ? " (Error)" : ""
	if (typeof block.content === "string") {
		return `[Tool Result${errorSuffix}]\n${block.content}`
	} else if (Array.isArray(block.content)) {
		const contentText = block.content
			.map((contentBlock) => {
				if (contentBlock.type === "text") {
					return contentBlock.text
				}
				if (contentBlock.type === "image") {
					return "[Image]"
				}
				return `[${(contentBlock as { type: string }).type}]`
			})
			.join("\n")
		return `[Tool Result${errorSuffix}]\n${contentText}`
	}
	return `[Tool Result${errorSuffix}]`
}

export function convertToolBlocksToText(
	content: string | Anthropic.Messages.ContentBlockParam[],
): string | Anthropic.Messages.ContentBlockParam[] {
	if (typeof content === "string") {
		return content
	}

	return content.map((block) => {
		if (block.type === "tool_use") {
			return {
				type: "text" as const,
				text: toolUseToText(block),
			}
		}
		if (block.type === "tool_result") {
			return {
				type: "text" as const,
				text: toolResultToText(block),
			}
		}
		return block
	})
}

export function transformMessagesForCondensing<
	T extends { role: string; content: string | Anthropic.Messages.ContentBlockParam[] },
>(messages: T[]): T[] {
	return messages.map((msg) => ({
		...msg,
		content: convertToolBlocksToText(msg.content),
	}))
}

export function extractCommandBlocks(message: ApiMessage): string {
	const content = message.content
	let text: string

	if (typeof content === "string") {
		text = content
	} else if (Array.isArray(content)) {
		text = content
			.filter((block): block is Anthropic.Messages.TextBlockParam => block.type === "text")
			.map((block) => block.text)
			.join("\n")
	} else {
		return ""
	}

	const commandRegex = /<command[^>]*>[\s\S]*?<\/command>/g
	const matches = text.match(commandRegex)

	if (!matches || matches.length === 0) {
		return ""
	}

	return matches.join("\n")
}

function collectToolIds(messages: ApiMessage[]): { toolCallIds: Set<string>; toolResultIds: Set<string> } {
	const toolCallIds = new Set<string>()
	const toolResultIds = new Set<string>()

	for (const msg of messages) {
		if (msg.role === "assistant" && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "tool_use") {
					toolCallIds.add(block.id)
				}
			}
		}
		if (msg.role === "user" && Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === "tool_result") {
					toolResultIds.add(block.tool_use_id)
				}
			}
		}
	}

	return { toolCallIds, toolResultIds }
}

export function injectSyntheticToolResults(messages: ApiMessage[]): ApiMessage[] {
	const { toolCallIds, toolResultIds } = collectToolIds(messages)

	const orphanIds = [...toolCallIds].filter((id) => !toolResultIds.has(id))

	if (orphanIds.length === 0) {
		return messages
	}

	const syntheticResults: Anthropic.Messages.ToolResultBlockParam[] = orphanIds.map((id) => ({
		type: "tool_result" as const,
		tool_use_id: id,
		content: "Context condensation triggered. Tool execution deferred.",
	}))

	const syntheticMessage: ApiMessage = {
		role: "user",
		content: syntheticResults,
		ts: Date.now(),
	}

	return [...messages, syntheticMessage]
}
