import { CommandExecutionStatus } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import type { ITaskModel } from "@features/chat/task/store"

import { JabberwockTerminalProcessResultPromise } from "@jabberwock/types"
import { getHostTerminalService } from "@features/foundation/capabilities/registry"

import { ToolResponse } from "@shared/tools"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { supersedePendingAsk } from "@features/chat/task/notifications/actions"
import { sendCommandExecutionStatus } from "@features/chat/task/events/actions/sendTaskEvent"

import {
	ShellIntegrationError,
	type ExecuteCommandOptions,
	createCommandOutputState,
	resolveWorkingDirectory,
	validateWorkingDirectory,
	createOutputInterceptor,
	getTaskWithTerminal,
} from "./executeCommandState"
import { createOutputPublisher, buildTerminalCallbacks } from "./executeCommandOutput"
import { raceCommandTimeouts, awaitPostTimeoutResult } from "./executeCommandTimeouts"

export async function executeWithShellFallback(
	task: ITaskModel,
	options: ExecuteCommandOptions,
	pushToolResult: (content: ToolResponse) => void,
	_handleError: (msg: string, error: Error) => Promise<void>,
): Promise<void> {
	try {
		const [rejected, result] = await executeCommandInTerminal(task, options)

		if (rejected) {
			task._state.setDidRejectTool(true)
		}

		pushToolResult(result)
	} catch (error: unknown) {
		const status: CommandExecutionStatus = { executionId: options.executionId, status: "fallback" }
		sendCommandExecutionStatus(status)
		await systemBroadcast(task.taskId, "shell_integration_warning")
		supersedePendingAsk(task.taskId)

		if (error instanceof ShellIntegrationError) {
			const [rejected, result] = await executeCommandInTerminal(task, {
				...options,
				terminalShellIntegrationDisabled: true,
			})

			if (rejected) {
				task._state.setDidRejectTool(true)
			}

			pushToolResult(result)
		} else {
			pushToolResult("Command failed to execute in terminal due to a shell integration error.")
		}
	}
}

export async function executeCommandInTerminal(
	task: ITaskModel,
	{
		executionId,
		command,
		customCwd,
		terminalShellIntegrationDisabled = true,
		commandExecutionTimeout = 0,
		agentTimeout = 0,
	}: ExecuteCommandOptions,
): Promise<[boolean, ToolResponse]> {
	const terminalProvider = terminalShellIntegrationDisabled ? "execa" : "vscode"

	const workingDir = resolveWorkingDirectory(task, customCwd)
	const dirError = await validateWorkingDirectory(workingDir)

	if (dirError) {
		return [false, dirError]
	}

	const state = createCommandOutputState()

	state.onCompletedPromise = new Promise<void>((resolve) => {
		state.resolveOnCompleted = resolve
	})

	const interceptor = await createOutputInterceptor(executionId, task.taskId, command, task.globalStoragePath)

	const { queueCommandOutputMessage, schedulePartialCommandOutputUpdate, maxAccumulatedOutputSize } =
		createOutputPublisher(task, state)

	const callbacks = buildTerminalCallbacks(
		task,
		executionId,
		interceptor,
		state,
		queueCommandOutputMessage,
		schedulePartialCommandOutputUpdate,
		maxAccumulatedOutputSize,
	)

	if (terminalProvider === "vscode") {
		callbacks.onNoShellIntegration = async (error: string) => {
			getTelemetryService().captureShellIntegrationError(task.taskId)
			state.shellIntegrationError = error
		}
	}

	// D4g-2 (batch 4): terminal creation via the host terminal service seam — the vscode connector
	// backs this with the real TerminalRegistry; server mode omits it, so the tool degrades to an
	// error (no host terminals available headless).
	const terminalService = getHostTerminalService()
	if (!terminalService) {
		return [false, "Terminal service not available in this host"]
	}

	const terminal = await terminalService.getOrCreateTerminal(workingDir, task.taskId, terminalProvider)
	terminalService.showTerminal(terminal)

	const cmdProcess: JabberwockTerminalProcessResultPromise = terminal.runCommand(command, callbacks)
	getTaskWithTerminal(task).terminalProcess = cmdProcess

	const timeoutResult = await raceCommandTimeouts(
		cmdProcess,
		agentTimeout,
		commandExecutionTimeout,
		task,
		state,
		executionId,
	)

	return awaitPostTimeoutResult(timeoutResult, state, workingDir)
}
