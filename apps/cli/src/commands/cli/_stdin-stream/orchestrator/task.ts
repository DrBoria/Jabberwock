import { isExpectedControlFlowError, isNoActiveTaskLikeError } from "../../cancellation.js"

import type { StdinStreamCommand, StdinStreamModeOptions } from "../types.js"
import { waitForPostCancelRecovery, shouldSendMessageAsAskResponse, isResumableState } from "../helpers.js"

import type { OrchestratorState } from "./state.js"

function isNoActiveTask(state: OrchestratorState, host: StdinStreamModeOptions["host"]): boolean {
	return !state.activeTaskPromise && state.activeTaskCommand !== "start" && !host.client.hasActiveTask()
}

export function handleMessageCommand(
	cmd: StdinStreamCommand & { command: "message" },
	state: OrchestratorState,
	host: StdinStreamModeOptions["host"],
	jsonEmitter: StdinStreamModeOptions["jsonEmitter"],
	setStreamRequestId: StdinStreamModeOptions["setStreamRequestId"],
	pendingQueuedMessageRequestIds: string[],
): void {
	if (state.awaitingPostCancelRecovery) waitForPostCancelRecovery(host)
	const wasResumable = isResumableState(host)
	const currentAsk = host.client.getCurrentAsk()
	if (shouldSendMessageAsAskResponse(host.isWaitingForInput(), currentAsk)) {
		jsonEmitter.emitControl({
			subtype: "ack",
			requestId: cmd.requestId,
			command: "message",
			taskId: state.latestTaskId,
			content: "message accepted",
			code: "accepted",
			success: true,
		})
		host.sendToExtension({
			type: "askResponse",
			askResponse: "messageResponse",
			text: cmd.prompt,
			images: cmd.images,
		})
		setStreamRequestId(cmd.requestId)
		jsonEmitter.emitControl({
			subtype: "done",
			requestId: cmd.requestId,
			command: "message",
			taskId: state.latestTaskId,
			content: "message sent to current ask",
			code: "responded",
			success: true,
		})
		state.awaitingPostCancelRecovery = false
		return
	}
	if (!host.client.hasActiveTask()) {
		jsonEmitter.emitControl({
			subtype: "error",
			requestId: cmd.requestId,
			command: "message",
			taskId: state.latestTaskId,
			content: "no active task; send a start command first",
			code: "no_active_task",
			success: false,
		})
		return
	}
	jsonEmitter.emitControl({
		subtype: "ack",
		requestId: cmd.requestId,
		command: "message",
		taskId: state.latestTaskId,
		content: "message accepted",
		code: "accepted",
		success: true,
	})
	host.sendToExtension({ type: "queueMessage", text: cmd.prompt, images: cmd.images })
	pendingQueuedMessageRequestIds.push(cmd.requestId)
	if (host.isWaitingForInput()) setStreamRequestId(cmd.requestId)
	jsonEmitter.emitControl({
		subtype: "done",
		requestId: cmd.requestId,
		command: "message",
		taskId: state.latestTaskId,
		content: wasResumable ? "resume message queued" : "message queued",
		code: wasResumable ? "resumed" : "queued",
		success: true,
	})
	state.awaitingPostCancelRecovery = false
}

function tryCancelTask(
	cmd: StdinStreamCommand & { command: "cancel" },
	state: OrchestratorState,
	host: StdinStreamModeOptions["host"],
	jsonEmitter: StdinStreamModeOptions["jsonEmitter"],
): void {
	try {
		host.client.cancelTask()
		jsonEmitter.emitControl({
			subtype: "done",
			requestId: cmd.requestId,
			command: "cancel",
			taskId: state.latestTaskId,
			content: "cancel signal sent",
			code: "cancel_requested",
			success: true,
		})
	} catch (error: unknown) {
		if (
			isExpectedControlFlowError(error, {
				stdinStreamMode: true,
				cancelRequested: true,
				shuttingDown: state.shouldShutdown,
				operation: "cancel",
			})
		) {
			const noActiveTask = isNoActiveTaskLikeError(error)
			jsonEmitter.emitControl({
				subtype: "done",
				requestId: cmd.requestId,
				command: "cancel",
				taskId: state.latestTaskId,
				content: noActiveTask ? "cancel ignored (task already settled)" : "cancel handled",
				code: noActiveTask ? "no_active_task" : "cancel_requested",
				success: true,
			})
			if (noActiveTask) state.awaitingPostCancelRecovery = false
			state.cancelRequestedForActiveTask = false
		} else {
			const message = error instanceof Error ? error.message : String(error)
			jsonEmitter.emitControl({
				subtype: "error",
				requestId: cmd.requestId,
				command: "cancel",
				taskId: state.latestTaskId,
				content: message,
				code: "cancel_error",
				success: false,
			})
		}
	}
}

export function handleCancelCommand(
	cmd: StdinStreamCommand & { command: "cancel" },
	state: OrchestratorState,
	host: StdinStreamModeOptions["host"],
	jsonEmitter: StdinStreamModeOptions["jsonEmitter"],
	setStreamRequestId: StdinStreamModeOptions["setStreamRequestId"],
): void {
	setStreamRequestId(cmd.requestId)
	if (isNoActiveTask(state, host)) {
		jsonEmitter.emitControl({
			subtype: "ack",
			requestId: cmd.requestId,
			command: "cancel",
			taskId: state.latestTaskId,
			content: "no active task to cancel",
			code: "accepted",
			success: true,
		})
		jsonEmitter.emitControl({
			subtype: "done",
			requestId: cmd.requestId,
			command: "cancel",
			taskId: state.latestTaskId,
			content: "cancel ignored (no active task)",
			code: "no_active_task",
			success: true,
		})
		return
	}
	state.cancelRequestedForActiveTask = true
	state.awaitingPostCancelRecovery = true
	jsonEmitter.emitControl({
		subtype: "ack",
		requestId: cmd.requestId,
		command: "cancel",
		taskId: state.latestTaskId,
		content: host.client.hasActiveTask() ? "cancel requested" : "cancel requested (task starting)",
		code: "accepted",
		success: true,
	})
	tryCancelTask(cmd, state, host, jsonEmitter)
}
