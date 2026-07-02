import { readCommandsFromStdinNdjson } from "../parser.js"
import { handleStartCommand } from "./start.js"
import { handleMessageCommand, handleCancelCommand } from "./task.js"
import {
	type OrchestratorState,
	handlePingCommand,
	handleShutdownCommand,
	createTaskCompletionHandler,
	createClientErrorHandler,
	handlePostLoopState,
} from "./state.js"
import { createExtensionMessageHandler } from "../message-handler.js"

import type { StdinStreamModeOptions } from "../types.js"

export async function runStdinStreamMode({
	host,
	jsonEmitter,
	setStreamRequestId,
}: StdinStreamModeOptions): Promise<void> {
	const state: OrchestratorState = {
		hasReceivedStdinCommand: false,
		shouldShutdown: false,
		activeTaskPromise: null,
		fatalStreamError: null,
		activeRequestId: undefined,
		activeTaskCommand: undefined,
		latestTaskId: undefined,
		cancelRequestedForActiveTask: false,
		awaitingPostCancelRecovery: false,
	}
	const pendingQueuedMessageRequestIds: string[] = []
	const queueMessageRequestIdByMessageId = new Map<string, string>()
	const onTaskCompleted = createTaskCompletionHandler(
		state,
		host,
		jsonEmitter,
		setStreamRequestId,
		[],
		pendingQueuedMessageRequestIds,
		queueMessageRequestIdByMessageId,
	)
	const offClientError = host.client.on(
		"error",
		createClientErrorHandler(state, host, jsonEmitter, setStreamRequestId),
	)
	const onExtensionMessage = createExtensionMessageHandler({
		jsonEmitter,
		setStreamRequestId,
		latestTaskIdRef: { current: state.latestTaskId },
		hasSeenQueueState: false,
		lastQueueDepth: 0,
		lastQueueMessageIds: [],
		pendingQueuedMessageRequestIds,
		queueMessageRequestIdByMessageId,
	})
	host.on("extensionWebviewMessage", onExtensionMessage)
	const offTaskCompleted = host.client.on("taskCompleted", onTaskCompleted)

	try {
		for await (const stdinCommand of readCommandsFromStdinNdjson()) {
			state.hasReceivedStdinCommand = true
			if (state.fatalStreamError) throw state.fatalStreamError
			switch (stdinCommand.command) {
				case "start":
					handleStartCommand(stdinCommand, state, host, jsonEmitter, setStreamRequestId)
					break
				case "message":
					handleMessageCommand(
						stdinCommand,
						state,
						host,
						jsonEmitter,
						setStreamRequestId,
						pendingQueuedMessageRequestIds,
					)
					break
				case "cancel":
					handleCancelCommand(stdinCommand, state, host, jsonEmitter, setStreamRequestId)
					break
				case "ping":
					handlePingCommand(stdinCommand, state, jsonEmitter)
					break
				case "shutdown":
					handleShutdownCommand(state)
					break
			}
			if (state.shouldShutdown) break
		}
		await handlePostLoopState(state, host)
	} finally {
		offClientError()
		host.off("extensionWebviewMessage", onExtensionMessage)
		offTaskCompleted()
	}
}
