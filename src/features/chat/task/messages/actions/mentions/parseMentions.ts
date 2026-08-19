import * as path from "path"
import * as vscode from "vscode"

import { unescapeSpaces } from "@shared/context/mentions"

import { openFile } from "@integrations/misc/open-file"

import { FileContextTracker } from "@features/foundation/time-machine/file-context/FileContextTracker"
import type { SkillLookup } from "@services/skills/skillInvocation"

import {
	checkCommandExistence,
	replaceCommandMentions,
	replaceMentionReferences,
	buildSlashCommandHelp,
} from "@features/chat/task/messages/actions/command/commandHelpers"
import { processMentions } from "./mentionHelpers"

export async function openMention(cwd: string, mention?: string): Promise<void> {
	if (!mention) {
		return
	}

	if (mention.startsWith("/")) {
		const relPath = unescapeSpaces(mention.slice(1))
		const absPath = path.resolve(cwd, relPath)
		if (mention.endsWith("/")) {
			vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(absPath))
		} else {
			openFile(absPath)
		}
	} else if (mention === "problems") {
		vscode.commands.executeCommand("workbench.actions.view.problems")
	} else if (mention === "terminal") {
		vscode.commands.executeCommand("workbench.action.terminal.focus")
	} else if (mention.startsWith("http")) {
		vscode.env.openExternal(vscode.Uri.parse(mention))
	}
}

export interface MentionContentBlock {
	type: "file" | "folder" | "url" | "diagnostics" | "git_changes" | "git_commit" | "terminal" | "command"
	path?: string
	content: string
	metadata?: {
		totalLines: number
		returnedLines: number
		wasTruncated: boolean
		linesShown?: [number, number]
	}
}

export interface ParseMentionsResult {
	text: string
	contentBlocks: MentionContentBlock[]
	slashCommandHelp?: string
	mode?: string
}

export async function parseMentions(
	text: string,
	cwd: string,
	fileContextTracker?: FileContextTracker,
	jabberwockIgnoreController?: string,
	showJabberwockIgnoredFiles: boolean = false,
	includeDiagnosticMessages: boolean = true,
	maxDiagnosticMessages: number = 50,
	skillsManager?: SkillLookup,
	currentMode: string = "code",
): Promise<ParseMentionsResult> {
	const mentions: Set<string> = new Set()
	const contentBlocks: MentionContentBlock[] = []

	const { validCommands, validSkills, commandMode, commandMatches } = await checkCommandExistence(
		text,
		cwd,
		skillsManager,
		currentMode,
	)

	let parsedText = replaceCommandMentions(text, commandMatches, validCommands, validSkills)

	parsedText = replaceMentionReferences(parsedText, mentions)

	const mentionSuffix = await processMentions(
		mentions,
		cwd,
		contentBlocks,
		jabberwockIgnoreController,
		showJabberwockIgnoredFiles,
		fileContextTracker,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
	)
	parsedText += mentionSuffix

	const slashCommandHelp = buildSlashCommandHelp(validCommands, validSkills)

	return {
		text: parsedText,
		contentBlocks,
		mode: commandMode,
		slashCommandHelp: slashCommandHelp || undefined,
	}
}
