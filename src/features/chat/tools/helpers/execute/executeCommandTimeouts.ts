import delay from "delay"

import { CommandExecutionStatus } from "@jabberwock/types"

import type { ITaskModel } from "@features/chat/task/store"

import { JabberwockTerminalProcessResultPromise } from "@integrations/terminal/types"

import { ToolResponse } from "@shared/tools"
import { t } from "@i18n"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { supersedePendingAsk } from "@features/chat/task/notifications/actions"
import { sendCommandExecutionStatus } from "@features/chat/task/events/actions/sendTaskEvent"

import { getTaskWithTerminal, type CommandOutputState, ShellIntegrationError } from "./executeCommandState"
import { formatCommandResult } from "./executeCommandFormat"

export function resolveAgentTimeoutMs(timeoutSeconds: number | null | undefined): number {
	const requestedAgentTimeout = typeof timeoutSeconds === "number" && timeoutSeconds > 0 ? timeoutSeconds * 1000 : 0

	return process.env.JABBERWOCK_CLI_RUNTIME === "1" ? 0 : requestedAgentTimeout
}

export interface TimeoutRaceResult {
	timedOut: boolean
	isUserTimedOut: boolean
	timeoutResponse: [boolean, ToolResponse] | undefined
}

export async function raceCommandTimeouts(
	cmdProcess: JabberwockTerminalProcessResultPromise,
	agentTimeout: number,
	commandExecutionTimeout: number,
	task: ITaskModel,
	state: { runInBackground: boolean; pendingCommandOutputEmitTimer: NodeJS.Timeout | undefined },
	executionId: string,
): Promise<TimeoutRaceResult> {
	let agentTimeoutId: NodeJS.Timeout | undefined
	let userTimeoutId: NodeJS.Timeout | undefined
	let isUserTimedOut = false

	try {
		const racers: Promise<void>[] = [cmdProcess as JabberwockTerminalProcessResultPromise]

		if (agentTimeout > 0) {
			racers.push(
				new Promise<void>((resolve) => {
					agentTimeoutId = setTimeout(() => {
						state.runInBackground = true
						cmdProcess.continue()
						supersedePendingAsk(task.taskId)
						resolve()
					}, agentTimeout)
				}),
			)
		}

		if (commandExecutionTimeout > 0) {
			racers.push(
				new Promise<void>((_, reject) => {
					userTimeoutId = setTimeout(() => {
						isUserTimedOut = true
						getTaskWithTerminal(task).terminalProcess?.abort()
						reject(new Error(`Command execution timed out after ${commandExecutionTimeout}ms`))
					}, commandExecutionTimeout)
				}),
			)
		}

		await Promise.race(racers)

		return { timedOut: false, isUserTimedOut: false, timeoutResponse: undefined }
	} catch (error) {
		if (isUserTimedOut) {
			const commandExecutionTimeoutSeconds = commandExecutionTimeout / 1000
			const status: CommandExecutionStatus = { executionId, status: "timeout" }
			sendCommandExecutionStatus(status)

			await systemBroadcast(
				task.taskId,
				"error",
				t("common:errors:command_timeout", { seconds: commandExecutionTimeoutSeconds }),
			)

			task._state.setDidToolFailInCurrentTurn(true)
			getTaskWithTerminal(task).terminalProcess = undefined

			return {
				timedOut: true,
				isUserTimedOut: true,
				timeoutResponse: [
					false,
					`The command was terminated after exceeding a user-configured ${commandExecutionTimeoutSeconds}s timeout. Do not try to re-run the command.`,
				],
			}
		}

		throw error
	} finally {
		clearTimeout(agentTimeoutId)
		clearTimeout(userTimeoutId)
		clearTimeout(state.pendingCommandOutputEmitTimer)
		getTaskWithTerminal(task).terminalProcess = undefined
	}
}

export async function awaitPostTimeoutResult(
	timeoutResult: TimeoutRaceResult,
	state: CommandOutputState,
	workingDir: string,
): Promise<[boolean, ToolResponse]> {
	if (timeoutResult.timedOut) {
		return timeoutResult.timeoutResponse!
	}

	if (state.shellIntegrationError) {
		throw new ShellIntegrationError(state.shellIntegrationError)
	}

	await delay(50)

	if (state.exitDetails && state.onCompletedPromise) {
		await state.onCompletedPromise
	}

	return formatCommandResult(state, workingDir)
}
