import path from "path"
import os from "os"

import * as vscode from "vscode"
import delay from "delay"

import { ContextCondense, TodoItem, TodoStatus } from "@jabberwock/types"
import type { ExperimentId, ModeConfig } from "@jabberwock/types"
import { ApiHandlerCreateMessageMetadata } from "@api"

import { formatLanguage } from "@shared/language"
import { defaultModeSlug } from "@shared/modes"
import { getFullModeDetails } from "@shared/modes/extension"
import { getApiMetrics } from "@shared/api/getApiMetrics"
import { listFiles } from "@services/glob/list-files"
import { TerminalRegistry } from "@integrations/terminal/TerminalRegistry"
import { Terminal } from "@integrations/terminal/terminal-core/Terminal"
import { arePathsEqual } from "@utils/io/path"
import { formatResponse } from "@features/settings/context/responses"
import { getGitStatus } from "@utils/git"
import { getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"
import { filterPaths } from "@utils/ignore"
import { getShell } from "@utils/shell"
import osName from "os-name"
import { getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"
import type { RooTerminal } from "@integrations/terminal/types"

import { buildNativeToolsArrayWithRestrictions } from "@features/chat/tools/actions/buildToolDefinitions"
import { summarizeConversation } from "@features/chat/task/condense/handlers/on-context-condense"
import type { ITaskModel } from "@features/chat/task/store"
import { flushPendingToolResultsToHistory } from "@features/chat/tools/actions/flushPendingToolResults"
import { overwriteApiConversationHistory } from "@features/chat/task/messages/actions/save/saveApiMessages"
import { getSystemPrompt } from "@features/settings/context/systemPrompt"
import { getState } from "@features/storeSingleton"

import {
	buildVisibleFilesSection,
	buildOpenTabsSection,
	buildTerminalDetails,
	buildRecentlyModifiedSection,
	buildCurrentTimeSection,
	buildSystemInfoSection,
	buildModeSection,
	buildFileListSection,
} from "./condenseContext.helpers"

export async function getEnvironmentDetails(task: ITaskModel, includeFileDetails: boolean): Promise<string> {
	let details = buildVisibleFilesSection(task)
	details += buildOpenTabsSection(task)

	const terminalDetails = await buildTerminalDetails(task)
	details += buildRecentlyModifiedSection()
	if (terminalDetails) {
		details += terminalDetails
	}

	details += buildCurrentTimeSection()
	details += buildSystemInfoSection(task)
	details += await buildModeSection(task)

	if (includeFileDetails) {
		details += await buildFileListSection(task)
	}

	const gitStatus = await getGitStatus(task.cwd, 0)
	if (gitStatus) {
		details += `\n\n# Git Status\n${gitStatus}`
	}

	return `<environment_details>\n${details.trim()}\n</environment_details>`
}

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
