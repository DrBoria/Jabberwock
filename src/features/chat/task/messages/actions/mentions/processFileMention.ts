import Anthropic from "@anthropic-ai/sdk"

import { MentionContentBlock } from "./parseMentions"

/**
 * Converts MentionContentBlocks to TextPart blocks.
 * Each file/folder mention becomes a separate text block formatted
 * to look like a read_file tool result.
 */
export function contentBlocksToTextParts(contentBlocks: MentionContentBlock[]): TextPart[] {
	return contentBlocks.map((block) => ({
		type: "text" as const,
		text: block.content,
	}))
}

export function buildTextParts(result: {
	text: string
	contentBlocks: MentionContentBlock[]
	slashCommandHelp?: string
}): Array<{ type: "text"; text: string }> {
	const parts: Array<{ type: "text"; text: string }> = [
		{
			type: "text" as const,
			text: result.text,
		},
	]

	for (const contentBlock of result.contentBlocks) {
		parts.push({
			type: "text" as const,
			text: contentBlock.content,
		})
	}

	if (result.slashCommandHelp) {
		parts.push({
			type: "text" as const,
			text: result.slashCommandHelp,
		})
	}

	return parts
}

type TextPart = Anthropic.Messages.TextBlockParam
