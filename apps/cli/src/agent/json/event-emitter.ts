import type { JsonEvent, JsonEventQueueItem } from "@/types/json-events.js"
import type { ExtensionClient } from "../extension/client.js"
import type { AgentStateChangeEvent, TaskCompletedEvent } from "../events/types.js"
import { JsonOutputWriter } from "./output-writer.js"
import { CommandOutputHandler } from "./command-output-handler.js"
import { JsonSayHandler } from "./say-handler.js"
import { JsonAskHandler } from "./ask-handler.js"
import type { JsonEmitterState } from "./emitter-utils.js"

export interface JsonEventEmitterOptions {
	mode: "json" | "stream-json"
	stdout?: NodeJS.WriteStream
	requestIdProvider?: () => string | undefined
	schemaVersion?: number
	protocol?: string
	capabilities?: string[]
}

export class JsonEventEmitter {
	private outputWriter: JsonOutputWriter
	private commandOutputHandler: CommandOutputHandler
	private sayHandler: JsonSayHandler
	private askHandler: JsonAskHandler
	private state: JsonEmitterState
	private unsubscribers: (() => void)[] = []
	private schemaVersion: number
	private protocol: string
	private capabilities: string[]
	private requestIdProvider: () => string | undefined

	constructor(options: JsonEventEmitterOptions) {
		this.schemaVersion = options.schemaVersion ?? 1
		this.protocol = options.protocol ?? "jabberwock-cli-stream"
		this.capabilities = options.capabilities ?? [
			"stdin:start",
			"stdin:message",
			"stdin:cancel",
			"stdin:ping",
			"stdin:shutdown",
		]
		this.requestIdProvider = options.requestIdProvider ?? (() => undefined)
		this.state = {
			seenMessageIds: new Set(),
			previousContent: new Map(),
			previousToolUseContent: new Map(),
			completionResultContent: undefined,
			lastAssistantText: undefined,
			expectPromptEchoAsUser: true,
			lastCost: undefined,
		}
		this.outputWriter = new JsonOutputWriter(options.mode, options.stdout, this.requestIdProvider)
		this.commandOutputHandler = new CommandOutputHandler(
			(event) => this.outputWriter.emitEvent(event),
			options.mode,
		)
		this.askHandler = new JsonAskHandler(
			this.state,
			(event) => this.outputWriter.emitEvent(event),
			options.mode,
			this.commandOutputHandler,
		)
		this.sayHandler = new JsonSayHandler(
			this.state,
			(event) => this.outputWriter.emitEvent(event),
			options.mode,
			this.commandOutputHandler,
			this.askHandler,
		)
	}

	attachToClient(client: ExtensionClient): void {
		this.unsubscribers.push(
			client.on("message", (msg) => this.sayHandler.handleMessage(msg, false)),
			client.on("messageUpdated", (msg) => this.sayHandler.handleMessage(msg, true)),
			client.on("stateChange", (event: AgentStateChangeEvent) => this.sayHandler.handleStateChange(event)),
			client.on("taskCompleted", (event: TaskCompletedEvent) => this.askHandler.handleTaskCompleted(event)),
			client.on("error", (error: Error) => this.askHandler.handleError(error)),
		)
		this.outputWriter.emitEvent({
			type: "system",
			subtype: "init",
			content: "Task started",
			schemaVersion: this.schemaVersion,
			protocol: this.protocol,
			capabilities: this.capabilities,
		})
	}

	emitControl(event: {
		subtype: "ack" | "done" | "error"
		requestId?: string
		command?: JsonEvent["command"]
		taskId?: string
		content?: string
		success?: boolean
		code?: string
	}): void {
		this.outputWriter.emitEvent({
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

	emitQueue(event: {
		subtype: "snapshot" | "enqueued" | "dequeued" | "drained" | "updated"
		taskId?: string
		content?: string
		queueDepth: number
		queue: JsonEventQueueItem[]
	}): void {
		this.outputWriter.emitEvent({
			type: "queue",
			subtype: event.subtype,
			taskId: event.taskId,
			content: event.content,
			queueDepth: event.queueDepth,
			queue: event.queue,
		})
	}

	detach(): void {
		for (const unsub of this.unsubscribers) {
			unsub()
		}
		this.unsubscribers = []
	}

	emitCommandOutputChunk(outputSnapshot: string): void {
		this.commandOutputHandler.emitCommandOutputChunk(outputSnapshot)
	}

	markCommandOutputExited(exitCode?: number): void {
		this.commandOutputHandler.markCommandOutputExited(exitCode)
	}

	emitCommandOutputDone(exitCode?: number): void {
		this.commandOutputHandler.emitCommandOutputDone(exitCode)
	}

	async flush(): Promise<void> {
		return this.outputWriter.flush()
	}

	getEvents(): JsonEvent[] {
		return this.outputWriter.getEvents()
	}
}
