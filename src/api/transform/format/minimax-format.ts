import { Anthropic } from "@anthropic-ai/sdk"

type ContentBlock = Anthropic.Messages.ContentBlockParam

/**
 * Merges text content (like environment_details) that follows tool_result blocks
 * into the last tool_result's content. This preserves reasoning continuity for
 * thinking models by avoiding separate user messages after tool results.
 *
 * Key behavior:
 * - User messages with ONLY tool_result blocks: keep as-is
 * - User messages with ONLY text/image: keep as-is
 * - User messages with tool_result blocks AND text blocks: merge the text blocks
 *   into the last tool_result's content
 *
 * @param messages Array of Anthropic messages
 * @returns Modified messages with text merged into tool_result content
 */
function classifyUserBlocks(content: Anthropic.ContentBlockParam[]): {
	toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[]
	textBlocks: Anthropic.Messages.TextBlockParam[]
	imageBlocks: Anthropic.Messages.ImageBlockParam[]
} {
	const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = []
	const textBlocks: Anthropic.Messages.TextBlockParam[] = []
	const imageBlocks: Anthropic.Messages.ImageBlockParam[] = []

	for (const block of content) {
		if (block.type === "tool_result") {
			toolResultBlocks.push(block)
		} else if (block.type === "text") {
			textBlocks.push(block)
		} else if (block.type === "image") {
			imageBlocks.push(block)
		}
	}

	return { toolResultBlocks, textBlocks, imageBlocks }
}

function extractToolResultContent(lastToolResult: Anthropic.Messages.ToolResultBlockParam): string {
	if (typeof lastToolResult.content === "string") {
		return lastToolResult.content
	}
	if (Array.isArray(lastToolResult.content)) {
		return (
			lastToolResult.content
				?.map((c) => {
					if (c.type === "text") return c.text
					if (c.type === "image") return "(image)"
					return ""
				})
				.join("\n") ?? ""
		)
	}
	return ""
}

function mergeTextIntoLastToolResult(
	toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[],
	textBlocks: Anthropic.Messages.TextBlockParam[],
): ContentBlock[] {
	const textContent = textBlocks.map((b) => b.text).join("\n\n")
	const modifiedToolResults = [...toolResultBlocks]
	const lastToolResult = modifiedToolResults[modifiedToolResults.length - 1]
	const existingContent = extractToolResultContent(lastToolResult)

	modifiedToolResults[modifiedToolResults.length - 1] = {
		...lastToolResult,
		content: existingContent ? `${existingContent}\n\n${textContent}` : textContent,
	}

	return modifiedToolResults as ContentBlock[]
}

export function mergeEnvironmentDetailsForMiniMax(
	messages: Anthropic.Messages.MessageParam[],
): Anthropic.Messages.MessageParam[] {
	const result: Anthropic.Messages.MessageParam[] = []

	for (const message of messages) {
		if (message.role !== "user") {
			result.push(message)
			continue
		}

		if (typeof message.content === "string") {
			result.push(message)
			continue
		}

		if (!Array.isArray(message.content)) {
			result.push(message)
			continue
		}

		const { toolResultBlocks, textBlocks, imageBlocks } = classifyUserBlocks(message.content)
		const hasToolResults = toolResultBlocks.length > 0
		const hasTextBlocks = textBlocks.length > 0
		const hasImageBlocks = imageBlocks.length > 0

		if (hasToolResults && hasTextBlocks && !hasImageBlocks) {
			result.push({
				...message,
				content: mergeTextIntoLastToolResult(toolResultBlocks, textBlocks),
			})
		} else {
			result.push(message)
		}
	}

	return result
}

/**
 * @deprecated Use mergeEnvironmentDetailsForMiniMax instead. This function extracted
 * environment_details to the system prompt, but the new approach merges them into
 * tool_result content like format does with mergeToolResultText.
 */
export function extractEnvironmentDetailsForMiniMax(messages: Anthropic.Messages.MessageParam[]): {
	messages: Anthropic.Messages.MessageParam[]
	extractedSystemContent: string[]
} {
	// For backwards compatibility, just return the merged messages with empty extracted content
	return {
		messages: mergeEnvironmentDetailsForMiniMax(messages),
		extractedSystemContent: [],
	}
}
