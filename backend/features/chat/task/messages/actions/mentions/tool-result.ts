import { parseMentions } from "./parse"
import type { ParseOptions } from "./text-block"
import { buildTextParts } from "./text-parts"
import type { ContentBlockParam, ToolResultBlockParam } from "@shared/content-blocks"

async function processToolResultStringContent(
	block: ToolResultBlockParam,
	options: ParseOptions,
): Promise<{ blocks: ContentBlockParam[]; mode: string | undefined }> {
	if (!(block.content as string).includes("<user_message>")) {
		return { blocks: [block], mode: undefined }
	}

	const result = await parseMentions(block.content as string, options)

	const contentParts = buildTextParts(result)

	return {
		blocks: [{ ...block, content: contentParts }],
		mode: result.mode,
	}
}

async function processToolResultArrayContent(
	block: ToolResultBlockParam,
	options: ParseOptions,
): Promise<{ blocks: ContentBlockParam[]; mode: string | undefined }> {
	const results = await Promise.all(
		(block.content as ContentBlockParam[]).map(async (contentBlock) => {
			if (contentBlock.type === "text" && contentBlock.text.includes("<user_message>")) {
				const result = await parseMentions(contentBlock.text, options)

				const blocks: Array<{ type: "text"; text: string }> = [
					{
						...contentBlock,
						text: result.text,
					},
				]

				for (const cb of result.contentBlocks) {
					blocks.push({
						type: "text" as const,
						text: cb.content,
					})
				}

				if (result.slashCommandHelp) {
					blocks.push({
						type: "text" as const,
						text: result.slashCommandHelp,
					})
				}

				return { blocks, mode: result.mode }
			}

			return { blocks: [contentBlock], mode: undefined }
		}),
	)

	const parsedContent = results.flatMap((r) => r.blocks)
	const mode = results.reduce<string | undefined>((m, r) => m ?? r.mode, undefined)

	return { blocks: [{ ...block, content: parsedContent }] as ContentBlockParam[], mode }
}

export async function processToolResultBlock(
	block: ToolResultBlockParam,
	options: ParseOptions,
): Promise<{ blocks: ContentBlockParam[]; mode: string | undefined }> {
	if (typeof block.content === "string") {
		return processToolResultStringContent(block, options)
	}

	if (Array.isArray(block.content)) {
		return processToolResultArrayContent(block, options)
	}

	return { blocks: [block], mode: undefined }
}
