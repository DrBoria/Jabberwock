import { CommandExecutionStatus } from "@jabberwock/types"

import { getMstState } from "@features/foundation/mst/store"
import { getBackendRootStore } from "@features/storeSingleton"

import type { ITaskModel } from "@features/chat/task/store"

import { ExitCodeDetails, JabberwockTerminalProcess, RooTerminalCallbacks } from "@integrations/terminal/types"
import { Terminal } from "@integrations/terminal/terminal-core/Terminal"
import { OutputInterceptor } from "@integrations/terminal/output-interceptor/OutputInterceptor"

import { userBroadcast } from "@features/chat/task/messages/actions/say"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { sendCommandExecutionStatus } from "@features/chat/task/events/actions/sendTaskEvent"

import type { CommandOutputState } from "./executeCommandState"

export function createOutputPublisher(task: ITaskModel, state: CommandOutputState) {
	const maxAccumulatedOutputSize = 100_000
	const commandOutputStreamThrottleMs = 150

	const queueCommandOutputMessage = async (text: string, partial: boolean, force = false): Promise<void> => {
		if (!force && text === state.lastQueuedCommandOutput) {
			return state.commandOutputSayChain
		}

		state.lastQueuedCommandOutput = text
		state.commandOutputSayChain = state.commandOutputSayChain
			.then(async () => {
				await userBroadcast(task.taskId, "command_output", text, undefined, partial, undefined, undefined, {
					isNonInteractive: true,
				})
			})
			.catch((error: unknown) => {
				console.error("[jabberwock] [ExecuteCommandTool] Failed to publish command output:", error)
			})

		return state.commandOutputSayChain
	}

	const schedulePartialCommandOutputUpdate = () => {
		if (!state.latestCompressedOutput || state.completed) {
			return
		}

		const emitUpdate = () => {
			state.pendingCommandOutputEmitTimer = undefined
			state.lastCommandOutputEmitAt = Date.now()
			void queueCommandOutputMessage(state.latestCompressedOutput, true)
		}

		const elapsed = Date.now() - state.lastCommandOutputEmitAt
		if (elapsed >= commandOutputStreamThrottleMs) {
			emitUpdate()
			return
		}

		if (!state.pendingCommandOutputEmitTimer) {
			state.pendingCommandOutputEmitTimer = setTimeout(emitUpdate, commandOutputStreamThrottleMs - elapsed)
		}
	}

	return { queueCommandOutputMessage, schedulePartialCommandOutputUpdate, maxAccumulatedOutputSize }
}

export function buildTerminalCallbacks(
	task: ITaskModel,
	executionId: string,
	interceptor: OutputInterceptor | undefined,
	state: CommandOutputState,
	queueCommandOutputMessage: (text: string, partial: boolean, force?: boolean) => Promise<void>,
	schedulePartialCommandOutputUpdate: () => void,
	maxAccumulatedOutputSize: number,
): RooTerminalCallbacks {
	const callbacks: RooTerminalCallbacks = {
		onLine: async (lines: string, process: JabberwockTerminalProcess) => {
			state.accumulatedOutput += lines

			if (state.accumulatedOutput.length > maxAccumulatedOutputSize) {
				state.accumulatedOutput = state.accumulatedOutput.slice(-maxAccumulatedOutputSize)
			}

			interceptor?.write(lines)

			const compressedOutput = Terminal.compressTerminalOutput(state.accumulatedOutput)
			state.latestCompressedOutput = compressedOutput
			const status: CommandExecutionStatus = { executionId, status: "output", output: compressedOutput }
			sendCommandExecutionStatus(status)
			getMstState(getBackendRootStore()).commandExecutionStore?.addOrUpdateExecution(status)
			schedulePartialCommandOutputUpdate()

			if (state.runInBackground || state.hasAskedForCommandOutput) {
				return
			}

			state.hasAskedForCommandOutput = true

			try {
				const { response, text, images } = await ask(task.taskId, "command_output", "")
				state.runInBackground = true

				if (response === "messageResponse") {
					state.message = { text, images }
					process.continue()
				}
			} catch (_error) {
				// Silently handle ask errors (e.g., "Current ask promise was ignored")
			}
		},
		onCompleted: async (output: string | undefined) => {
			try {
				clearTimeout(state.pendingCommandOutputEmitTimer)
				state.pendingCommandOutputEmitTimer = undefined

				if (interceptor) {
					state.persistedResult = await interceptor.finalize()
				}

				state.result = Terminal.compressTerminalOutput(output ?? "")
				state.latestCompressedOutput = state.result

				await state.commandOutputSayChain
				await queueCommandOutputMessage(state.result, false, true)
				state.completed = true
			} finally {
				state.resolveOnCompleted?.()
			}
		},
		onShellExecutionStarted: (pid: number | undefined) => {
			const status: CommandExecutionStatus = { executionId, status: "started", pid, command: "?" }
			sendCommandExecutionStatus(status)
			getMstState(getBackendRootStore()).commandExecutionStore?.addOrUpdateExecution(status)
		},
		onShellExecutionComplete: (details: ExitCodeDetails) => {
			const status: CommandExecutionStatus = { executionId, status: "exited", exitCode: details.exitCode }
			sendCommandExecutionStatus(status)
			getMstState(getBackendRootStore()).commandExecutionStore?.addOrUpdateExecution(status)
			state.exitDetails = details
		},
	}

	return callbacks
}
