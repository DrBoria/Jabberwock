import type {
	ExtensionMessage,
	WebviewMessage,
	AskResponseValue,
	Notification,
	NotificationAsk,
} from "@jabberwock/types"

import { StateStore } from "../store/state-store.js"
import { MessageProcessor } from "../messages/message-processor.js"
import { parseExtensionMessage } from "../messages/message-validators.js"
import { TypedEventEmitter } from "../events/typed-emitter.js"
import type { ClientEventMap, AgentStateChangeEvent, WaitingForInputEvent, ModeChangedEvent } from "../events/types.js"
import type { AgentStateInfo } from "../state/agent-state-types.js"
import { AgentLoopState } from "../state/agent-state-types.js"

export interface ExtensionClientConfig {
	sendMessage: (message: WebviewMessage) => void
	emitAllStateChanges?: boolean
	debug?: boolean
	maxHistorySize?: number
}

export class ExtensionClient {
	private store: StateStore
	private processor: MessageProcessor
	private emitter: TypedEventEmitter
	private sendMessage: (message: WebviewMessage) => void
	private debug: boolean

	constructor(config: ExtensionClientConfig) {
		this.sendMessage = config.sendMessage
		this.debug = config.debug ?? false
		this.store = new StateStore({ maxHistorySize: config.maxHistorySize ?? 0 })
		this.emitter = new TypedEventEmitter()
		this.processor = new MessageProcessor(this.store, this.emitter, {
			emitAllStateChanges: config.emitAllStateChanges ?? true,
			debug: config.debug ?? false,
		})
	}

	handleMessage(message: ExtensionMessage | string): void {
		const parsed = typeof message === "string" ? parseExtensionMessage(message) : message
		if (!parsed) {
			if (this.debug) {
				console.log("[ExtensionClient] Failed to parse message:", message)
			}
			return
		}
		this.processor.processMessage(parsed)
	}

	handleMessages(messages: (ExtensionMessage | string)[]): void {
		for (const message of messages) {
			this.handleMessage(message)
		}
	}

	getAgentState(): AgentStateInfo {
		return this.store.getAgentState()
	}

	getCurrentState(): AgentLoopState {
		return this.store.getCurrentState()
	}

	isWaitingForInput(): boolean {
		return this.store.isWaitingForInput()
	}

	isRunning(): boolean {
		return this.store.isRunning()
	}

	isStreaming(): boolean {
		return this.store.isStreaming()
	}

	hasActiveTask(): boolean {
		return this.store.getCurrentState() !== AgentLoopState.NO_TASK
	}

	getMessages(): Notification[] {
		return this.store.getMessages()
	}

	getLastMessage(): Notification | undefined {
		return this.store.getLastMessage()
	}

	getCurrentAsk(): NotificationAsk | undefined {
		return this.store.getAgentState().currentAsk
	}

	isInitialized(): boolean {
		return this.store.isInitialized()
	}

	getCurrentMode(): string | undefined {
		return this.store.getCurrentMode()
	}

	on<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): () => void {
		return this.emitter.on(event, listener)
	}

	once<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): void {
		this.emitter.once(event, listener)
	}

	off<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): void {
		this.emitter.off(event, listener)
	}

	removeAllListeners<K extends keyof ClientEventMap>(event?: K): void {
		this.emitter.removeAllListeners(event)
	}

	onStateChange(listener: (event: AgentStateChangeEvent) => void): () => void {
		return this.on("stateChange", listener)
	}

	onWaitingForInput(listener: (event: WaitingForInputEvent) => void): () => void {
		return this.on("waitingForInput", listener)
	}

	onModeChanged(listener: (event: ModeChangedEvent) => void): () => void {
		return this.on("modeChanged", listener)
	}

	approve(): void {
		this.sendResponse("yesButtonClicked")
	}

	reject(): void {
		this.sendResponse("noButtonClicked")
	}

	respond(text: string, images?: string[]): void {
		this.sendResponse("messageResponse", text, images)
	}

	sendResponse(response: AskResponseValue, text?: string, images?: string[]): void {
		this.sendMessage({ type: "askResponse", askResponse: response, text, images } as WebviewMessage)
	}

	newTask(text: string, images?: string[]): void {
		this.sendMessage({ type: "newTask", text, images } as WebviewMessage)
	}

	clearTask(): void {
		this.sendMessage({ type: "clearTask" } as WebviewMessage)
		this.processor.notifyTaskCleared()
	}

	cancelTask(): void {
		this.sendMessage({ type: "cancelTask" } as WebviewMessage)
	}

	resumeTask(): void {
		this.approve()
	}

	retryApiRequest(): void {
		this.approve()
	}

	continueTerminal(): void {
		this.sendMessage({ type: "terminalOperation", terminalOperation: "continue" } as WebviewMessage)
	}

	abortTerminal(): void {
		this.sendMessage({ type: "terminalOperation", terminalOperation: "abort" } as WebviewMessage)
	}

	reset(): void {
		this.store.reset()
		this.emitter.removeAllListeners()
	}

	getStateHistory() {
		return this.store.getHistory()
	}

	setDebug(enabled: boolean): void {
		this.debug = enabled
		this.processor.setDebug(enabled)
	}

	getStore(): StateStore {
		return this.store
	}

	getEmitter(): TypedEventEmitter {
		return this.emitter
	}
}

export function createClient(sendMessage: (message: WebviewMessage) => void): ExtensionClient {
	return new ExtensionClient({ sendMessage })
}

export function createMockClient(): {
	client: ExtensionClient
	sentMessages: WebviewMessage[]
	clearMessages: () => void
} {
	const sentMessages: WebviewMessage[] = []
	const client = new ExtensionClient({ sendMessage: (message) => sentMessages.push(message), debug: false })
	return {
		client,
		sentMessages,
		clearMessages: () => {
			sentMessages.length = 0
		},
	}
}
