import { randomUUID } from "crypto"

import { isCancellationLikeError, isExpectedControlFlowError } from "../../cancellation.js"

import type { StdinStreamCommand, StdinStreamModeOptions } from "../types.js"
import type { OrchestratorState } from "./state.js"

export function handleStartCommand(
	cmd: StdinStreamCommand & { command: "start" },
	state: OrchestratorState,
	host: StdinStreamModeOptions["host"],
	jsonEmitter: StdinStreamModeOptions["jsonEmitter"],
	setStreamRequestId: StdinStreamModeOptions["setStreamRequestId"],
): void {
	if (state.activeTaskPromise && !host.client.hasActiveTask()) {
		state.activeTaskPromise = (async () => {
			try {
				await state.activeTaskPromise
			} catch {
				/* Errors emitted through control/error events */
			}
		})()
	}
	if (state.activeTaskPromise || host.client.hasActiveTask()) {
		jsonEmitter.emitControl({
			subtype: "error",
			requestId: cmd.requestId,
			command: "start",
			taskId: state.latestTaskId,
			content: "cannot start a new task while another task is active",
			code: "task_busy",
			success: false,
		})
		return
	}
	state.activeRequestId = cmd.requestId
	state.activeTaskCommand = "start"
	setStreamRequestId(cmd.requestId)
	state.latestTaskId = cmd.taskId ?? randomUUID()
	state.cancelRequestedForActiveTask = false
	state.awaitingPostCancelRecovery = false
	jsonEmitter.emitControl({
		subtype: "ack",
		requestId: cmd.requestId,
		command: "start",
		taskId: state.latestTaskId,
		content: "starting task",
		code: "accepted",
		success: true,
	})
	const taskConfiguration = { terminalShellIntegrationDisabled: true, ...(cmd.configuration ?? {}) }
	state.activeTaskPromise = host
		.runTask(cmd.prompt, state.latestTaskId, taskConfiguration, cmd.images)
		.catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error)
			if (
				isExpectedControlFlowError(error, {
					stdinStreamMode: true,
					cancelRequested: state.cancelRequestedForActiveTask,
					shuttingDown: state.shouldShutdown,
					operation: "client",
				})
			) {
				if (
					state.activeTaskCommand === "start" &&
					(state.cancelRequestedForActiveTask || isCancellationLikeError(error))
				) {
					jsonEmitter.emitControl({
						subtype: "done",
						requestId: state.activeRequestId,
						command: "start",
						taskId: state.latestTaskId,
						content: "task cancelled",
						code: "task_aborted",
						success: false,
					})
				}
				state.activeTaskCommand = undefined
				state.activeRequestId = undefined
				setStreamRequestId(undefined)
				state.cancelRequestedForActiveTask = false
				state.awaitingPostCancelRecovery = false
				return
			}
			state.fatalStreamError = error instanceof Error ? error : new Error(message)
			state.activeTaskCommand = undefined
			state.activeRequestId = undefined
			setStreamRequestId(undefined)
			jsonEmitter.emitControl({
				subtype: "error",
				requestId: state.activeRequestId,
				command: "start",
				taskId: state.latestTaskId,
				content: message,
				code: "task_error",
				success: false,
			})
		})
		.finally(() => {
			state.activeTaskPromise = null
		})
}
