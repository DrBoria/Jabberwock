import Anthropic from "@anthropic-ai/sdk"

import { parseMentions } from "./parseMentions"
import { ParseOptions } from "./processContextMention"
import { buildTextParts } from "./processFileMention"

async function processToolResultStringContent(
	block: Anthropic.Messages.ToolResultBlockParam,
	options: ParseOptions,
): Promise<{ blocks: Anthropic.Messages.ContentBlockParam[]; mode: string | undefined }> {
	if (!(block.content as string).includes("<user_message>")) {
		return { blocks: [block], mode: undefined }
	}

	const result = await parseMentions(
		block.content as string,
		options.cwd,
		options.fileContextTracker,
		options.jabberwockIgnoreController,
		options.showJabberwockIgnoredFiles,
		options.includeDiagnosticMessages,
		options.maxDiagnosticMessages,
		options.skillsManager,
		options.currentMode,
	)

	const contentParts = buildTextParts(result)

	return {
		blocks: [{ ...block, content: contentParts }],
		mode: result.mode,
	}
}

async function processToolResultArrayContent(
	block: Anthropic.Messages.ToolResultBlockParam,
	options: ParseOptions,
): Promise<{ blocks: Anthropic.Messages.ContentBlockParam[]; mode: string | undefined }> {
	const results = await Promise.all(
		(block.content as Anthropic.Messages.ContentBlockParam[]).map(async (contentBlock) => {
			if (contentBlock.type === "text" && contentBlock.text.includes("<user_message>")) {
				const result = await parseMentions(
					contentBlock.text,
					options.cwd,
					options.fileContextTracker,
					options.jabberwockIgnoreController,
					options.showJabberwockIgnoredFiles,
					options.includeDiagnosticMessages,
					options.maxDiagnosticMessages,
					options.skillsManager,
					options.currentMode,
				)

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

	return { blocks: [{ ...block, content: parsedContent }] as Anthropic.Messages.ContentBlockParam[], mode }
}

export async function processToolResultBlock(
	block: Anthropic.Messages.ToolResultBlockParam,
	options: ParseOptions,
): Promise<{ blocks: Anthropic.Messages.ContentBlockParam[]; mode: string | undefined }> {
	if (typeof block.content === "string") {
		return processToolResultStringContent(block, options)
	}

	if (Array.isArray(block.content)) {
		return processToolResultArrayContent(block, options)
	}

	return { blocks: [block], mode: undefined }
}
