import { isCancellationLikeError, isExpectedControlFlowError } from "../../cancellation.js"

import type { StdinStreamCommand, StdinStreamModeOptions } from "../types.js"
import { waitForTaskProgressAfterStdinClosed } from "../helpers.js"

export interface OrchestratorState {
	hasReceivedStdinCommand: boolean
	shouldShutdown: boolean
	activeTaskPromise: Promise<void> | null
	fatalStreamError: Error | null
	activeRequestId: string | undefined
	activeTaskCommand: "start" | undefined
	latestTaskId: string | undefined
	cancelRequestedForActiveTask: boolean
	awaitingPostCancelRecovery: boolean
}

export function handlePingCommand(
	cmd: StdinStreamCommand & { command: "ping" },
	state: OrchestratorState,
	jsonEmitter: StdinStreamModeOptions["jsonEmitter"],
): void {
	jsonEmitter.emitControl({
		subtype: "ack",
		requestId: cmd.requestId,
		command: "ping",
		taskId: state.latestTaskId,
		content: "pong",
		code: "accepted",
		success: true,
	})
	jsonEmitter.emitControl({
		subtype: "done",
		requestId: cmd.requestId,
		command: "ping",
		taskId: state.latestTaskId,
		content: "pong",
		code: "pong",
		success: true,
	})
}

export function handleShutdownCommand(state: OrchestratorState): void {
	state.shouldShutdown = true
}

export function createTaskCompletionHandler(
	state: OrchestratorState,
	host: StdinStreamModeOptions["host"],
	jsonEmitter: StdinStreamModeOptions["jsonEmitter"],
	setStreamRequestId: StdinStreamModeOptions["setStreamRequestId"],
	lastQueueMessageIds: string[],
	pendingQueuedMessageRequestIds: string[],
	queueMessageRequestIdByMessageId: Map<string, string>,
) {
	return (event: { success: boolean }) => {
		if (state.activeTaskCommand !== "start") return
		const completionCode = event.success
			? "task_completed"
			: state.cancelRequestedForActiveTask
				? "task_aborted"
				: "task_failed"
		jsonEmitter.emitControl({
			subtype: "done",
			requestId: state.activeRequestId,
			command: "start",
			taskId: state.latestTaskId,
			content: event.success
				? "task completed"
				: state.cancelRequestedForActiveTask
					? "task cancelled"
					: "task failed",
			code: completionCode,
			success: event.success,
		})
		const oldestQueuedMessageId = lastQueueMessageIds[0]
		const nextQueuedRequestId =
			pendingQueuedMessageRequestIds[0] ??
			(oldestQueuedMessageId ? queueMessageRequestIdByMessageId.get(oldestQueuedMessageId) : undefined)
		if (nextQueuedRequestId) setStreamRequestId(nextQueuedRequestId)
		state.activeTaskCommand = undefined
		state.activeRequestId = undefined
		state.cancelRequestedForActiveTask = false
	}
}

export function createClientErrorHandler(
	state: OrchestratorState,
	host: StdinStreamModeOptions["host"],
	jsonEmitter: StdinStreamModeOptions["jsonEmitter"],
	setStreamRequestId: StdinStreamModeOptions["setStreamRequestId"],
) {
	return (error: unknown) => {
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
		state.fatalStreamError = error instanceof Error ? error : new Error(String(error))
		jsonEmitter.emitControl({
			subtype: "error",
			requestId: state.activeRequestId,
			command: state.activeTaskCommand,
			taskId: state.latestTaskId,
			content: (error instanceof Error ? error : new Error(String(error))).message,
			code: "client_error",
			success: false,
		})
	}
}

export async function handlePostLoopState(
	state: OrchestratorState,
	host: StdinStreamModeOptions["host"],
): Promise<void> {
	if (!state.hasReceivedStdinCommand) throw new Error("no stdin command provided")
	if (state.shouldShutdown && host.client.hasActiveTask()) host.client.cancelTask()
	if (state.shouldShutdown) return
	if (state.activeTaskPromise) {
		await state.activeTaskPromise
		return
	}
	if (host.client.hasActiveTask())
		await waitForTaskProgressAfterStdinClosed(host, () => ({ hasSeenQueueState: false, queueDepth: 0 }))
}
