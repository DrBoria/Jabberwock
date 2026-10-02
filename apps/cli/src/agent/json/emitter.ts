import type { JsonEvent, JsonEventQueueItem } from "@/types/json-events.js"
import type { ExtensionClient } from "../extension/client.js"
import type { AgentStateChangeEvent, TaskCompletedEvent } from "../events/types.js"
import { createJsonOutputWriter } from "./output-writer.js"
import { createCommandOutputHandler } from "./command-output-handler.js"
import { createJsonSayHandler } from "./say-handler.js"
import { createJsonAskHandler } from "./ask-handler.js"
import type { JsonEmitterState } from "./delta.js"

export interface JsonEventEmitterOptions {
	mode: "json" | "stream-json"
	stdout?: NodeJS.WriteStream
	requestIdProvider?: () => string | undefined
	schemaVersion?: number
	protocol?: string
	capabilities?: string[]
}

export function createJsonEventEmitter(options: JsonEventEmitterOptions) {
	const schemaVersion = options.schemaVersion ?? 1
	const protocol = options.protocol ?? "jabberwock-cli-stream"
	const capabilities = options.capabilities ?? [
		"stdin:start",
		"stdin:message",
		"stdin:cancel",
		"stdin:ping",
		"stdin:shutdown",
	]
	const requestIdProvider = options.requestIdProvider ?? (() => undefined)
	const state: JsonEmitterState = {
		seenMessageIds: new Set(),
		previousContent: new Map(),
		previousToolUseContent: new Map(),
		completionResultContent: undefined,
		lastAssistantText: undefined,
		expectPromptEchoAsUser: true,
		lastCost: undefined,
	}
	let unsubscribers: (() => void)[] = []
	const outputWriter = createJsonOutputWriter(options.mode, options.stdout, requestIdProvider)
	const commandOutputHandler = createCommandOutputHandler((event) => outputWriter.emitEvent(event), options.mode)
	const askHandler = createJsonAskHandler(
		state,
		(event) => outputWriter.emitEvent(event),
		options.mode,
		commandOutputHandler,
	)
	const sayHandler = createJsonSayHandler(
		state,
		(event) => outputWriter.emitEvent(event),
		options.mode,
		commandOutputHandler,
		askHandler,
	)

	function attachToClient(client: ExtensionClient): void {
		unsubscribers.push(
			client.on("message", (msg) => sayHandler.handleMessage(msg, false)),
			client.on("messageUpdated", (msg) => sayHandler.handleMessage(msg, true)),
			client.on("stateChange", (event: AgentStateChangeEvent) => sayHandler.handleStateChange(event)),
			client.on("taskCompleted", (event: TaskCompletedEvent) => askHandler.handleTaskCompleted(event)),
			client.on("error", (error: Error) => askHandler.handleError(error)),
		)
		outputWriter.emitEvent({
			type: "system",
			subtype: "init",
			content: "Task started",
			schemaVersion,
			protocol,
			capabilities,
		})
	}

	function emitControl(event: {
		subtype: "ack" | "done" | "error"
		requestId?: string
		command?: JsonEvent["command"]
		taskId?: string
		content?: string
		success?: boolean
		code?: string
	}): void {
		outputWriter.emitEvent({
			type: "control",
			subtype: event.subtype,
			requestId: event.requestId,
			command: event.command,
			taskId: event.taskId,
			content: event.content,
			success: event.success,
			code: event.code,
			done: event.subtype === "done" ? true : undefined,
		})
	}

	function emitQueue(event: {
		subtype: "snapshot" | "enqueued" | "dequeued" | "drained" | "updated"
		taskId?: string
		content?: string
		queueDepth: number
		queue: JsonEventQueueItem[]
	}): void {
		outputWriter.emitEvent({
			type: "queue",
			subtype: event.subtype,
			taskId: event.taskId,
			content: event.content,
			queueDepth: event.queueDepth,
			queue: event.queue,
		})
	}

	function detach(): void {
		for (const unsub of unsubscribers) {
			unsub()
		}
		unsubscribers = []
	}

	function emitCommandOutputChunk(outputSnapshot: string): void {
		commandOutputHandler.emitCommandOutputChunk(outputSnapshot)
	}

	function markCommandOutputExited(exitCode?: number): void {
		commandOutputHandler.markCommandOutputExited(exitCode)
	}

	function emitCommandOutputDone(exitCode?: number): void {
		commandOutputHandler.emitCommandOutputDone(exitCode)
	}

	async function flush(): Promise<void> {
		return outputWriter.flush()
	}

	function getEvents(): JsonEvent[] {
		return outputWriter.getEvents()
	}

	return {
		attachToClient,
		emitControl,
		emitQueue,
		detach,
		emitCommandOutputChunk,
		markCommandOutputExited,
		emitCommandOutputDone,
		flush,
		getEvents,
	}
}

/** JsonEventEmitter instance type */
export type JsonEventEmitter = ReturnType<typeof createJsonEventEmitter>
