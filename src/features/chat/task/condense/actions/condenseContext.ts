import path from "path"
import os from "os"

import * as vscode from "vscode"
import delay from "delay"

import { ContextCondense, TodoItem, TodoStatus } from "@jabberwock/types"
import type { ExperimentId, ModeConfig } from "@jabberwock/types"
import { ApiHandlerCreateMessageMetadata } from "../../../../../api"

import { formatLanguage } from "../../../../../shared/language"
import { defaultModeSlug } from "../../../../../shared/modes"
import { getFullModeDetails } from "../../../../../shared/modes-extension"
import { getApiMetrics } from "../../../../../shared/getApiMetrics"
import { listFiles } from "../../../../../services/glob/list-files"
import { TerminalRegistry } from "../../../../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../../../../integrations/terminal/Terminal"
import { arePathsEqual } from "../../../../../utils/path"
import { formatResponse } from "../../../../settings/context/responses"
import { getGitStatus } from "../../../../../utils/git"
import { getVirtualWorkspace } from "../../../../foundation/time-machine/actions/getTimeMachine"
import { filterPaths } from "@utils/ignore"
import { getShell } from "../../../../../utils/shell"
import osName from "os-name"
import { getFileContextTracker } from "../../../../foundation/time-machine/actions/getTimeMachine"

import { buildNativeToolsArrayWithRestrictions } from "../../../tools/actions/buildToolDefinitions"
import { summarizeConversation } from "../handlers/on-context-condense"
import type { ITaskModel } from "../../store"
import { flushPendingToolResultsToHistory } from "../../../tools/actions/flushPendingToolResults"
import { overwriteApiConversationHistory } from "../../messages/actions/saveApiConversation"
import { getSystemPrompt } from "../../../../settings/context/systemPrompt"
import { getState } from "@features/storeSingleton"

// ── getEnvironmentDetails ─────────────────────────────────────────────────────

/**
 * Generates the <environment_details> XML block for the current task context.
 * Handles visible files, open tabs, terminal output, file modifications,
 * system info, current mode, and workspace file listing.
 *
 * Ported from `src/core/environment/getEnvironmentDetails.ts` during
 * the Phase 9 → condenseContext.ts inlining migration.
 */
export async function getEnvironmentDetails(task: ITaskModel, includeFileDetails: boolean): Promise<string> {
	let details = ""

	// Visible Files
	const visibleFilePaths = vscode.window.visibleTextEditors
		?.map((editor) => editor.document?.uri?.fsPath)
		.filter(Boolean)
		.map((absolutePath) => path.relative(task.cwd, absolutePath))

	// Filter paths through jabberwockIgnoreController
	const allowedVisibleFiles = task.jabberwockIgnoreController
		? filterPaths(task.jabberwockIgnoreController, visibleFilePaths, task.cwd)
		: visibleFilePaths.map((p) => p.toPosix()).join("\n")

	if (allowedVisibleFiles) {
		details += "\n\n# VSCode Visible Files"
		details += `\n${allowedVisibleFiles}`
	}

	// Open Tabs
	const openTabPaths = vscode.window.tabGroups.all
		.flatMap((group) => group.tabs)
		.filter((tab) => tab.input instanceof vscode.TabInputText)
		.map((tab) => (tab.input as vscode.TabInputText).uri.fsPath)
		.filter(Boolean)
		.map((absolutePath) => path.relative(task.cwd, absolutePath).toPosix())

	const allowedOpenTabs = task.jabberwockIgnoreController
		? filterPaths(task.jabberwockIgnoreController, openTabPaths, task.cwd)
		: openTabPaths.map((p) => p.toPosix()).join("\n")

	if (allowedOpenTabs) {
		details += "\n\n# VSCode Open Tabs"
		details += `\n${allowedOpenTabs}`
	}

	// ── Terminal output ──────────────────────────────────────────────
	const busyTerminals = [
		...TerminalRegistry.getTerminals(true, task.taskId),
		...TerminalRegistry.getBackgroundTerminals(true),
	]

	const inactiveTerminals = [
		...TerminalRegistry.getTerminals(false, task.taskId),
		...TerminalRegistry.getBackgroundTerminals(false),
	]

	if (busyTerminals.length > 0) {
		if (task.didEditFile) {
			await delay(300)
		}
	}

	let terminalDetails = ""

	if (busyTerminals.length > 0) {
		terminalDetails += "\n\n# Actively Running Terminals"
		for (const busyTerminal of busyTerminals) {
			const cwd = busyTerminal.getCurrentWorkingDirectory()
			terminalDetails += `\n## Terminal ${busyTerminal.id} (Active)`
			terminalDetails += `\n### Working Directory: \`${cwd}\``
			terminalDetails += `\n### Original command: \`${busyTerminal.getLastCommand()}\``
			let newOutput = TerminalRegistry.getUnretrievedOutput(busyTerminal.id)
			if (newOutput) {
				newOutput = Terminal.compressTerminalOutput(newOutput)
				terminalDetails += `\n### New Output\n${newOutput}`
			}
		}
	}

	const terminalsWithOutput = inactiveTerminals.filter((terminal) => {
		const completedProcesses = terminal.getProcessesWithOutput()
		return completedProcesses.length > 0
	})

	if (terminalsWithOutput.length > 0) {
		terminalDetails += "\n\n# Inactive Terminals with Completed Process Output"
		for (const inactiveTerminal of terminalsWithOutput) {
			const completedProcesses = inactiveTerminal.getProcessesWithOutput()
			const terminalOutputs: string[] = []
			for (const process of completedProcesses) {
				let output = process.getUnretrievedOutput()
				if (output) {
					output = Terminal.compressTerminalOutput(output)
					terminalOutputs.push(`Command: \`${process.command}\`\n${output}`)
				}
			}
			inactiveTerminal.cleanCompletedProcessQueue()
			if (terminalOutputs.length > 0) {
				const cwd = inactiveTerminal.getCurrentWorkingDirectory()
				terminalDetails += `\n## Terminal ${inactiveTerminal.id} (Inactive)`
				terminalDetails += `\n### Working Directory: \`${cwd}\``
				terminalOutputs.forEach((output) => {
					terminalDetails += `\n### New Output\n${output}`
				})
			}
		}
	}

	// ── Recently modified files ──────────────────────────────────────
	const fileContextTracker = getFileContextTracker()
	const recentlyModifiedFiles = fileContextTracker.getAndClearRecentlyModifiedFiles()
	if (recentlyModifiedFiles.length > 0) {
		details += "\n\n# Recently Modified Files"
		for (const filePath of recentlyModifiedFiles) {
			details += `\n${filePath}`
		}
	}

	if (terminalDetails) {
		details += terminalDetails
	}

	// ── Current time ─────────────────────────────────────────────────
	const now = new Date()
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
	const timeZoneOffset = -now.getTimezoneOffset() / 60
	const timeZoneOffsetHours = Math.floor(Math.abs(timeZoneOffset))
	const timeZoneOffsetMinutes = Math.abs(Math.round((Math.abs(timeZoneOffset) - timeZoneOffsetHours) * 60))
	const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : "-"}${timeZoneOffsetHours}:${timeZoneOffsetMinutes.toString().padStart(2, "0")}`
	details += `\n\n# Current Time\nCurrent time in ISO 8601 UTC format: ${now.toISOString()}\nUser time zone: ${timeZone}, UTC${timeZoneOffsetStr}`

	// ── System info section ──────────────────────────────────────────
	const osInfo = osName()
	details += `\n\n====\n\nSYSTEM INFORMATION\n\nOperating System: ${osInfo}\nDefault Shell: ${getShell()}\nHome Directory: ${os.homedir().toPosix()}\nCurrent Workspace Directory: ${task.cwd.toPosix()}\n\nThe Current Workspace Directory is the active VS Code project directory...`

	// ── Current Mode ─────────────────────────────────────────────────
	const currentMode = task.taskMode ?? "code"
	const customModes: ModeConfig[] = []
	const modeDetails = await getFullModeDetails(currentMode, customModes, undefined, {
		cwd: task.cwd,
		globalCustomInstructions: "",
	})
	const modelId = task.api?.getModel().id ?? "unknown"
	details += `\n\n# Current Mode\n<slug>${currentMode}</slug>\n<name>${modeDetails.name}</name>\n<model>${modelId}</model>\n`

	if (includeFileDetails) {
		details += `\n\n# Current Workspace Directory (${task.cwd.toPosix()}) Files\n`
		const isDesktop = arePathsEqual(task.cwd, path.join(os.homedir(), "Desktop"))
		if (isDesktop) {
			details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
		} else {
			const [files, didHitLimit] = await listFiles(task.cwd, true, 200, getVirtualWorkspace())
			const virtualWorkspace = getVirtualWorkspace()
			const result = formatResponse.formatFilesList(
				task.cwd,
				files,
				didHitLimit,
				task.jabberwockIgnoreController,
				false,
			)
			details += result
		}
	}

	// ── Git status ───────────────────────────────────────────────────
	const gitStatus = await getGitStatus(task.cwd, 0)
	if (gitStatus) {
		details += `\n\n# Git Status\n${gitStatus}`
	}

	return `<environment_details>\n${details.trim()}\n</environment_details>`
}

/**
 * Triggers context condensation for the given task.
 * Summarizes the conversation history using the LLM and updates the task's
 * API conversation history with the condensed result.
 */
export async function condenseContext(task: ITaskModel): Promise<void> {
	const apiHandler = task.api
	if (!apiHandler) {
		console.warn("[condenseContext] No API handler available for task", task.taskId)
		return
	}

	const messages = task.apiConversationHistory
	if (!messages || messages.length === 0) {
		return
	}

	const systemPrompt = await getSystemPrompt(task)

	const result = await summarizeConversation({
		messages,
		apiHandler,
		systemPrompt,
		taskId: task.taskId,
		isAutomaticTrigger: false,
		cwd: task.cwd,
		jabberwockIgnoreController: task.jabberwockIgnoreController,
	})

	if (result.messages && result.messages.length > 0) {
		await overwriteApiConversationHistory(task, result.messages)
	}
}
