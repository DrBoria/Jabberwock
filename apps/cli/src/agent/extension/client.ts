import type {
	ExtensionMessage,
	WebviewMessage,
	AskResponseValue,
	Notification,
	NotificationAsk,
} from "@jabberwock/types"

import { createStateStore, type StateStore } from "../store.js"
import { createMessageProcessor, type MessageProcessor } from "../messages/processor.js"
import { parseExtensionMessage } from "../messages/parse.js"
import { createTypedEventEmitter, type TypedEventEmitter } from "../events/typed-emitter.js"
import type { ClientEventMap, AgentStateChangeEvent, WaitingForInputEvent, ModeChangedEvent } from "../events/types.js"
import type { AgentStateInfo } from "../state/types.js"
import { AgentLoopState } from "../state/types.js"

export interface ExtensionClientConfig {
	sendMessage: (message: WebviewMessage) => void
	emitAllStateChanges?: boolean
	debug?: boolean
	maxHistorySize?: number
}

export function createExtensionClient(config: ExtensionClientConfig) {
	const store: StateStore = createStateStore({ maxHistorySize: config.maxHistorySize ?? 0 })
	const emitter: TypedEventEmitter = createTypedEventEmitter()
	const processor: MessageProcessor = createMessageProcessor(store, emitter, {
		emitAllStateChanges: config.emitAllStateChanges ?? true,
		debug: config.debug ?? false,
	})
	const sendMessage = config.sendMessage
	let debug = config.debug ?? false

	function handleMessage(message: ExtensionMessage | string): void {
		const parsed = typeof message === "string" ? parseExtensionMessage(message) : message
		if (!parsed) {
			if (debug) {
				console.log("[ExtensionClient] Failed to parse message:", message)
			}
			return
		}
		processor.processMessage(parsed)
	}

	function handleMessages(messages: (ExtensionMessage | string)[]): void {
		for (const message of messages) {
			handleMessage(message)
		}
	}

	function getAgentState(): AgentStateInfo {
		return store.getAgentState()
	}

	function getCurrentState(): AgentLoopState {
		return store.getCurrentState()
	}

	function isWaitingForInput(): boolean {
		return store.isWaitingForInput()
	}

	function isRunning(): boolean {
		return store.isRunning()
	}

	function isStreaming(): boolean {
		return store.isStreaming()
	}

	function hasActiveTask(): boolean {
		return store.getCurrentState() !== AgentLoopState.NO_TASK
	}

	function getMessages(): Notification[] {
		return store.getMessages()
	}

	function getLastMessage(): Notification | undefined {
		return store.getLastMessage()
	}

	function getCurrentAsk(): NotificationAsk | undefined {
		return store.getAgentState().currentAsk
	}

	function isInitialized(): boolean {
		return store.isInitialized()
	}

	function getCurrentMode(): string | undefined {
		return store.getCurrentMode()
	}

	function on<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): () => void {
		return emitter.on(event, listener)
	}

	function once<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): void {
		emitter.once(event, listener)
	}

	function off<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): void {
		emitter.off(event, listener)
	}

	function removeAllListeners<K extends keyof ClientEventMap>(event?: K): void {
		emitter.removeAllListeners(event)
	}

	function onStateChange(listener: (event: AgentStateChangeEvent) => void): () => void {
		return on("stateChange", listener)
	}

	function onWaitingForInput(listener: (event: WaitingForInputEvent) => void): () => void {
		return on("waitingForInput", listener)
	}

	function onModeChanged(listener: (event: ModeChangedEvent) => void): () => void {
		return on("modeChanged", listener)
	}

	function approve(): void {
		sendResponse("yesButtonClicked")
	}

	function reject(): void {
		sendResponse("noButtonClicked")
	}

	function respond(text: string, images?: string[]): void {
		sendResponse("messageResponse", text, images)
	}

	function sendResponse(response: AskResponseValue, text?: string, images?: string[]): void {
		sendMessage({ type: "askResponse", askResponse: response, text, images } as WebviewMessage)
	}

	function newTask(text: string, images?: string[]): void {
		sendMessage({ type: "newTask", text, images } as WebviewMessage)
	}

	function clearTask(): void {
		sendMessage({ type: "clearTask" } as WebviewMessage)
		processor.notifyTaskCleared()
	}

	function cancelTask(): void {
		sendMessage({ type: "cancelTask" } as WebviewMessage)
	}

	function resumeTask(): void {
		approve()
	}

	function retryApiRequest(): void {
		approve()
	}

	function continueTerminal(): void {
		sendMessage({ type: "terminalOperation", terminalOperation: "continue" } as WebviewMessage)
	}

	function abortTerminal(): void {
		sendMessage({ type: "terminalOperation", terminalOperation: "abort" } as WebviewMessage)
	}

	function reset(): void {
		store.reset()
		emitter.removeAllListeners()
	}

	function getStateHistory(): ReturnType<StateStore["getHistory"]> {
		return store.getHistory()
	}

	function setDebug(enabled: boolean): void {
		debug = enabled
		processor.setDebug(enabled)
	}

	function getStore(): StateStore {
		return store
	}

	function getEmitter(): TypedEventEmitter {
		return emitter
	}

	return {
		handleMessage,
		handleMessages,
		getAgentState,
		getCurrentState,
		isWaitingForInput,
		isRunning,
		isStreaming,
		hasActiveTask,
		getMessages,
		getLastMessage,
		getCurrentAsk,
		isInitialized,
		getCurrentMode,
		on,
		once,
		off,
		removeAllListeners,
		onStateChange,
		onWaitingForInput,
		onModeChanged,
		approve,
		reject,
		respond,
		sendResponse,
		newTask,
		clearTask,
		cancelTask,
		resumeTask,
		retryApiRequest,
		continueTerminal,
		abortTerminal,
		reset,
		getStateHistory,
		setDebug,
		getStore,
		getEmitter,
	}
}

export type ExtensionClient = ReturnType<typeof createExtensionClient>

export function createMockClient(): {
	client: ExtensionClient
	sentMessages: WebviewMessage[]
	clearMessages: () => void
} {
	const sentMessages: WebviewMessage[] = []
	const client = createExtensionClient({
		sendMessage: (message) => sentMessages.push(message),
		debug: false,
	})
	return {
		client,
		sentMessages,
		clearMessages: () => {
			sentMessages.length = 0
		},
	}
}
