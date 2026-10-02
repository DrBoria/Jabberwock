import { FileContextTracker } from "@features/foundation"
import type { SkillLookup } from "@features/settings/skills"
import type { ContentBlockParam, ImageBlockParam, TextBlockParam } from "@shared/content-blocks"
import { parseMentions } from "./parse"
import { contentBlocksToTextParts } from "./text-parts"

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

type TextPart = TextBlockParam
type ImagePart = ImageBlockParam

export async function processTextBlock(
	block: TextBlockParam,
	options: ParseOptions,
): Promise<{ blocks: ContentBlockParam[]; mode: string | undefined }> {
	if (!block.text.includes("<user_message>")) {
		return { blocks: [block], mode: undefined }
	}

	const result = await parseMentions(block.text, options)

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
