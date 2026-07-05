import path from "path"
import os from "os"

import * as vscode from "vscode"
import delay from "delay"

import { formatResponse } from "@features/settings/context/responses"
import { listFiles } from "@services/glob/list-files"
import { TerminalRegistry } from "@integrations/terminal/TerminalRegistry"
import { Terminal } from "@integrations/terminal/terminal-core/Terminal"
import { arePathsEqual } from "@utils/io/path"
import { getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"
import { filterPaths } from "@utils/ignore"
import { getShell } from "@utils/shell"
import osName from "os-name"
import { getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"
import type { RooTerminal } from "@integrations/terminal/types"
import type { ModeConfig } from "@jabberwock/types"
import { getFullModeDetails } from "@shared/modes/extension"
import type { ITaskModel } from "@features/chat/task/store"

export function buildVisibleFilesSection(task: ITaskModel): string {
	const visibleFilePaths = vscode.window.visibleTextEditors
		?.map((editor) => editor.document?.uri?.fsPath)
		.filter(Boolean)
		.map((absolutePath) => path.relative(task.cwd, absolutePath))

	const allowedVisibleFiles = task.jabberwockIgnoreController
		? filterPaths(task.jabberwockIgnoreController, visibleFilePaths, task.cwd)
		: visibleFilePaths.map((p) => p.toPosix()).join("\n")

	if (!allowedVisibleFiles) {
		return ""
	}

	return `\n\n# VSCode Visible Files\n${allowedVisibleFiles}`
}

export function buildOpenTabsSection(task: ITaskModel): string {
	const openTabPaths = vscode.window.tabGroups.all
		.flatMap((group) => group.tabs)
		.filter((tab) => tab.input instanceof vscode.TabInputText)
		.map((tab) => (tab.input as vscode.TabInputText).uri.fsPath)
		.filter(Boolean)
		.map((absolutePath) => path.relative(task.cwd, absolutePath).toPosix())

	const allowedOpenTabs = task.jabberwockIgnoreController
		? filterPaths(task.jabberwockIgnoreController, openTabPaths, task.cwd)
		: openTabPaths.map((p) => p.toPosix()).join("\n")

	if (!allowedOpenTabs) {
		return ""
	}

	return `\n\n# VSCode Open Tabs\n${allowedOpenTabs}`
}

export async function buildTerminalDetails(task: ITaskModel): Promise<string> {
	const busyTerminals = [
		...TerminalRegistry.getTerminals(true, task.taskId),
		...TerminalRegistry.getBackgroundTerminals(true),
	]

	const inactiveTerminals = [
		...TerminalRegistry.getTerminals(false, task.taskId),
		...TerminalRegistry.getBackgroundTerminals(false),
	]

	if (busyTerminals.length > 0 && task.didEditFile) {
		await delay(300)
	}

	let terminalDetails = ""

	if (busyTerminals.length > 0) {
		terminalDetails += buildBusyTerminalsSection(busyTerminals)
	}

	const terminalsWithOutput = inactiveTerminals.filter((terminal) => {
		const completedProcesses = terminal.getProcessesWithOutput()
		return completedProcesses.length > 0
	})

	if (terminalsWithOutput.length > 0) {
		terminalDetails += buildInactiveTerminalsSection(terminalsWithOutput)
	}

	return terminalDetails
}

function buildBusyTerminalsSection(busyTerminals: RooTerminal[]): string {
	let section = "\n\n# Actively Running Terminals"
	for (const busyTerminal of busyTerminals) {
		section += `\n## Terminal ${busyTerminal.id} (Active)`
		section += `\n### Working Directory: \`${busyTerminal.getCurrentWorkingDirectory()}\``
		section += `\n### Original command: \`${busyTerminal.getLastCommand()}\``
		const newOutput = TerminalRegistry.getUnretrievedOutput(busyTerminal.id)
		if (newOutput) {
			section += `\n### New Output\n${Terminal.compressTerminalOutput(newOutput)}`
		}
	}
	return section
}

function buildInactiveTerminalsSection(terminalsWithOutput: RooTerminal[]): string {
	let section = "\n\n# Inactive Terminals with Completed Process Output"
	for (const inactiveTerminal of terminalsWithOutput) {
		const completedProcesses = inactiveTerminal.getProcessesWithOutput()
		const terminalOutputs: string[] = []
		for (const process of completedProcesses) {
			const output = process.getUnretrievedOutput()
			if (output) {
				terminalOutputs.push(`Command: \`${process.command}\`\n${Terminal.compressTerminalOutput(output)}`)
			}
		}
		inactiveTerminal.cleanCompletedProcessQueue()
		if (terminalOutputs.length > 0) {
			section += `\n## Terminal ${inactiveTerminal.id} (Inactive)`
			section += `\n### Working Directory: \`${inactiveTerminal.getCurrentWorkingDirectory()}\``
			for (const output of terminalOutputs) {
				section += `\n### New Output\n${output}`
			}
		}
	}
	return section
}

export function buildRecentlyModifiedSection(): string {
	const fileContextTracker = getFileContextTracker()
	const recentlyModifiedFiles = fileContextTracker.getAndClearRecentlyModifiedFiles()

	if (recentlyModifiedFiles.length === 0) {
		return ""
	}

	let section = "\n\n# Recently Modified Files"
	for (const filePath of recentlyModifiedFiles) {
		section += `\n${filePath}`
	}

	return section
}

export function buildCurrentTimeSection(): string {
	const now = new Date()
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
	const timeZoneOffset = -now.getTimezoneOffset() / 60
	const timeZoneOffsetHours = Math.floor(Math.abs(timeZoneOffset))
	const timeZoneOffsetMinutes = Math.abs(Math.round((Math.abs(timeZoneOffset) - timeZoneOffsetHours) * 60))
	const sign = timeZoneOffset >= 0 ? "+" : "-"
	const paddedMinutes = timeZoneOffsetMinutes.toString().padStart(2, "0")
	const timeZoneOffsetStr = `${sign}${timeZoneOffsetHours}:${paddedMinutes}`

	return `\n\n# Current Time\nCurrent time in ISO 8601 UTC format: ${now.toISOString()}\nUser time zone: ${timeZone}, UTC${timeZoneOffsetStr}`
}

export function buildSystemInfoSection(task: ITaskModel): string {
	const osInfo = osName()
	return `\n\n====\n\nSYSTEM INFORMATION\n\nOperating System: ${osInfo}\nDefault Shell: ${getShell()}\nHome Directory: ${os.homedir().toPosix()}\nCurrent Workspace Directory: ${task.cwd.toPosix()}\n\nThe Current Workspace Directory is the active VS Code project directory...`
}

export async function buildModeSection(task: ITaskModel): Promise<string> {
	const currentMode = task.taskMode ?? "code"
	const customModes: ModeConfig[] = []
	const modeDetails = await getFullModeDetails(currentMode, customModes, undefined, {
		cwd: task.cwd,
		globalCustomInstructions: "",
	})
	const modelId = task.api?.getModel().id ?? "unknown"

	return `\n\n# Current Mode\n<slug>${currentMode}</slug>\n<name>${modeDetails.name}</name>\n<model>${modelId}</model>\n`
}

export async function buildFileListSection(task: ITaskModel): Promise<string> {
	let section = `\n\n# Current Workspace Directory (${task.cwd.toPosix()}) Files\n`

	const isDesktop = arePathsEqual(task.cwd, path.join(os.homedir(), "Desktop"))
	if (isDesktop) {
		section += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
		return section
	}

	const [files, didHitLimit] = await listFiles(task.cwd, true, 200, getVirtualWorkspace())
	const result = formatResponse.formatFilesList(task.cwd, files, didHitLimit, task.jabberwockIgnoreController, false)
	section += result

	return section
}
