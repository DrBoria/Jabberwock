import { ParseOptions, processTextBlock } from "./text-block"
import { processToolResultBlock } from "./tool-result"
import { FileContextTracker } from "@features/foundation"
import type { SkillLookup } from "@features/settings/skills"
import type { ContentBlockParam } from "@shared/content-blocks"

export interface ProcessUserContentMentionsResult {
	content: ContentBlockParam[]
	mode?: string
}

/**
 * Process mentions in user content, specifically within task and feedback tags.
 *
 * File/folder @ mentions are now returned as separate text blocks that
 * look like read_file tool results, making it clear to the model that
 * the file has already been read.
 */
export async function processUserContentMentions({
	userContent,
	cwd,
	fileContextTracker,
	jabberwockIgnoreController,
	showJabberwockIgnoredFiles = false,
	includeDiagnosticMessages = true,
	maxDiagnosticMessages = 50,
	skillsManager,
	currentMode = "code",
}: {
	userContent: ContentBlockParam[]
	cwd: string
	fileContextTracker: FileContextTracker
	jabberwockIgnoreController?: string
	showJabberwockIgnoredFiles?: boolean
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
	skillsManager?: SkillLookup
	currentMode?: string
}): Promise<ProcessUserContentMentionsResult> {
	const parseOptions: ParseOptions = {
		cwd,
		fileContextTracker,
		jabberwockIgnoreController,
		showJabberwockIgnoredFiles,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
		skillsManager,
		currentMode,
	}

	const results = await Promise.all(
		userContent.map(async (block) => {
			if (block.type === "text") {
				return processTextBlock(block, parseOptions)
			}

			if (block.type === "tool_result") {
				return processToolResultBlock(block, parseOptions)
			}

			return { blocks: [block], mode: undefined }
		}),
	)

	const content = results.flatMap((r) => r.blocks)
	const commandMode = results.reduce<string | undefined>((mode, r) => mode ?? r.mode, undefined)

	return { content, mode: commandMode }
}
