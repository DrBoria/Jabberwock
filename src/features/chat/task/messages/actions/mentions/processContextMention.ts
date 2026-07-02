import Anthropic from "@anthropic-ai/sdk"

import { parseMentions } from "./parseMentions"
import { FileContextTracker } from "@features/foundation/time-machine/file-context/FileContextTracker"
import type { SkillLookup } from "@services/skills/skillInvocation"
import { contentBlocksToTextParts } from "./processFileMention"

export interface ParseOptions {
	cwd: string
	fileContextTracker: FileContextTracker
	jabberwockIgnoreController?: string
	showJabberwockIgnoredFiles: boolean
	includeDiagnosticMessages: boolean
	maxDiagnosticMessages: number
	skillsManager?: SkillLookup
	currentMode: string
}

type TextPart = Anthropic.Messages.TextBlockParam
type ImagePart = Anthropic.Messages.ImageBlockParam

export async function processTextBlock(
	block: Anthropic.Messages.TextBlockParam,
	options: ParseOptions,
): Promise<{ blocks: Anthropic.Messages.ContentBlockParam[]; mode: string | undefined }> {
	if (!block.text.includes("<user_message>")) {
		return { blocks: [block], mode: undefined }
	}

	const result = await parseMentions(
		block.text,
		options.cwd,
		options.fileContextTracker,
		options.jabberwockIgnoreController,
		options.showJabberwockIgnoredFiles,
		options.includeDiagnosticMessages,
		options.maxDiagnosticMessages,
		options.skillsManager,
		options.currentMode,
	)

	const blocks: Array<TextPart | ImagePart> = [
		{
			...block,
			text: result.text,
		},
	]

	if (result.contentBlocks.length > 0) {
		blocks.push(...contentBlocksToTextParts(result.contentBlocks))
	}

	if (result.slashCommandHelp) {
		blocks.push({
			type: "text" as const,
			text: result.slashCommandHelp,
		})
	}

	return { blocks, mode: result.mode }
}
