import fs from "fs/promises"
import * as path from "path"

import {
	DEFAULT_TERMINAL_OUTPUT_PREVIEW_SIZE,
	PersistedCommandOutput,
	TerminalOutputPreviewSize,
} from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"

import { ExitCodeDetails, JabberwockTerminalProcessResultPromise } from "@integrations/terminal/types"
import { getTaskDirectoryPath } from "@utils/io"
import { OutputInterceptor } from "@integrations/terminal/output-interceptor/OutputInterceptor"

export class ShellIntegrationError extends Error {}

export type ExecuteCommandOptions = {
	executionId: string
	command: string
	customCwd?: string
	terminalShellIntegrationDisabled?: boolean
	commandExecutionTimeout?: number
	agentTimeout?: number
}

export interface CommandOutputState {
	message: { text?: string; images?: string[] } | undefined
	runInBackground: boolean
	completed: boolean
	result: string
	persistedResult: PersistedCommandOutput | undefined
	exitDetails: ExitCodeDetails | undefined
	shellIntegrationError: string | undefined
	hasAskedForCommandOutput: boolean
	accumulatedOutput: string
	latestCompressedOutput: string
	lastQueuedCommandOutput: string
	lastCommandOutputEmitAt: number
	pendingCommandOutputEmitTimer: NodeJS.Timeout | undefined
	commandOutputSayChain: Promise<void>
	onCompletedPromise: Promise<void> | undefined
	resolveOnCompleted: (() => void) | undefined
}

export function createCommandOutputState(): CommandOutputState {
	return {
		message: undefined,
		runInBackground: false,
		completed: false,
		result: "",
		persistedResult: undefined,
		exitDetails: undefined,
		shellIntegrationError: undefined,
		hasAskedForCommandOutput: false,
		accumulatedOutput: "",
		latestCompressedOutput: "",
		lastQueuedCommandOutput: "",
		lastCommandOutputEmitAt: 0,
		pendingCommandOutputEmitTimer: undefined,
		commandOutputSayChain: Promise.resolve(),
		onCompletedPromise: undefined,
		resolveOnCompleted: undefined,
	}
}

export function resolveWorkingDirectory(task: ITaskModel, customCwd?: string): string {
	if (!customCwd) {
		return task.cwd
	}

	if (path.isAbsolute(customCwd)) {
		return customCwd
	}

	return path.resolve(task.cwd, customCwd)
}

export async function validateWorkingDirectory(workingDir: string): Promise<string | null> {
	try {
		await fs.access(workingDir)
		return null
	} catch {
		return `Working directory '${workingDir}' does not exist.`
	}
}

export async function createOutputInterceptor(
	executionId: string,
	taskId: string,
	command: string,
	globalStoragePath: string | undefined,
): Promise<OutputInterceptor | undefined> {
	if (!globalStoragePath) {
		return undefined
	}

	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const storageDir = path.join(taskDir, "command-output")
	const terminalOutputPreviewSize = DEFAULT_TERMINAL_OUTPUT_PREVIEW_SIZE

	return new OutputInterceptor({
		executionId,
		taskId,
		command,
		storageDir,
		previewSize: terminalOutputPreviewSize as TerminalOutputPreviewSize,
	})
}

export function getTaskWithTerminal(
	task: ITaskModel,
): ITaskModel & { terminalProcess: JabberwockTerminalProcessResultPromise | undefined } {
	return task as ITaskModel & { terminalProcess: JabberwockTerminalProcessResultPromise | undefined }
}
