import * as vscode from "vscode"

import { getCommitInfo } from "@utils/git"
import { getWorkingState } from "@utils/git"
import { diagnosticsToProblemsString } from "@integrations/diagnostics"
import { FileContextTracker } from "@features/foundation/time-machine/file-context/FileContextTracker"

import { processFileMention } from "@features/chat/task/messages/actions/file-mentions/fileMentionHelpers"
import type { ContentBlockShape } from "@features/chat/task/messages/actions/types"

export async function processProblemsMention(
	cwd: string,
	includeDiagnosticMessages: boolean,
	maxDiagnosticMessages: number,
): Promise<string> {
	try {
		const problems = await getWorkspaceProblems(cwd, includeDiagnosticMessages, maxDiagnosticMessages)
		return `\n\n<workspace_diagnostics>\n${problems}\n</workspace_diagnostics>`
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error)
		return `\n\n<workspace_diagnostics>\nError fetching diagnostics: ${errMsg}\n</workspace_diagnostics>`
	}
}

export async function processGitChangesMention(cwd: string): Promise<string> {
	try {
		const workingState = await getWorkingState(cwd)
		return `\n\n<git_working_state>\n${workingState}\n</git_working_state>`
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error)
		return `\n\n<git_working_state>\nError fetching working state: ${errMsg}\n</git_working_state>`
	}
}

export async function processGitCommitMention(mention: string, cwd: string): Promise<string> {
	try {
		const commitInfo = await getCommitInfo(mention, cwd)
		return `\n\n<git_commit hash="${mention}">\n${commitInfo}\n</git_commit>`
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error)
		return `\n\n<git_commit hash="${mention}">\nError fetching commit info: ${errMsg}\n</git_commit>`
	}
}

export async function processTerminalMention(): Promise<string> {
	try {
		const terminalOutput = await getLatestTerminalOutput()
		return `\n\n<terminal_output>\n${terminalOutput}\n</terminal_output>`
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error)
		return `\n\n<terminal_output>\nError fetching terminal output: ${errMsg}\n</terminal_output>`
	}
}

export async function processMentions(
	mentions: Set<string>,
	cwd: string,
	contentBlocks: ContentBlockShape[],
	jabberwockIgnoreController: string | undefined,
	showJabberwockIgnoredFiles: boolean,
	fileContextTracker: FileContextTracker | undefined,
	includeDiagnosticMessages: boolean,
	maxDiagnosticMessages: number,
): Promise<string> {
	let result = ""
	for (const mention of mentions) {
		if (mention.startsWith("/")) {
			const block = await processFileMention(
				mention,
				cwd,
				jabberwockIgnoreController,
				showJabberwockIgnoredFiles,
				fileContextTracker,
			)
			contentBlocks.push(block)
		} else if (mention === "problems") {
			result += await processProblemsMention(cwd, includeDiagnosticMessages, maxDiagnosticMessages)
		} else if (mention === "git-changes") {
			result += await processGitChangesMention(cwd)
		} else if (/^[a-f0-9]{7,40}$/.test(mention)) {
			result += await processGitCommitMention(mention, cwd)
		} else if (mention === "terminal") {
			result += await processTerminalMention()
		}
	}
	return result
}

async function getWorkspaceProblems(
	cwd: string,
	includeDiagnosticMessages: boolean = true,
	maxDiagnosticMessages: number = 50,
): Promise<string> {
	const diagnostics = vscode.languages.getDiagnostics()
	const result = await diagnosticsToProblemsString(
		diagnostics,
		[vscode.DiagnosticSeverity.Error, vscode.DiagnosticSeverity.Warning],
		cwd,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
	)
	if (!result) {
		return "No errors or warnings detected."
	}
	return result
}

export async function getLatestTerminalOutput(): Promise<string> {
	const originalClipboard = await vscode.env.clipboard.readText()

	try {
		await vscode.commands.executeCommand("workbench.action.terminal.selectAll")

		await vscode.commands.executeCommand("workbench.action.terminal.copySelection")

		await vscode.commands.executeCommand("workbench.action.terminal.clearSelection")

		let terminalContents = (await vscode.env.clipboard.readText()).trim()

		if (terminalContents === originalClipboard) {
			return ""
		}

		const lines = terminalContents.split("\n")
		const lastLine = lines.pop()?.trim()

		if (lastLine) {
			let i = lines.length - 1

			while (i >= 0 && !lines[i].trim().startsWith(lastLine)) {
				i--
			}

			terminalContents = lines.slice(Math.max(i, 0)).join("\n")
		}

		return terminalContents
	} finally {
		await vscode.env.clipboard.writeText(originalClipboard)
	}
}
