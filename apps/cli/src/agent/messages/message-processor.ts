import { ExtensionMessage } from "@jabberwock/types"
import { debugLog } from "@jabberwock/core/cli"

import type { StateStore } from "../store/state-store.js"
import type { TypedEventEmitter } from "../events/typed-emitter.js"
import { buildStateUpdateInfo, emitStateChangeEvents, emitNewMessageEvents } from "./message-processor-utils.js"

export interface MessageProcessorOptions {
	emitAllStateChanges?: boolean
	debug?: boolean
}

export class MessageProcessor {
	private store: StateStore
	private emitter: TypedEventEmitter
	private options: Required<MessageProcessorOptions>

	constructor(store: StateStore, emitter: TypedEventEmitter, options: MessageProcessorOptions = {}) {
		this.store = store
		this.emitter = emitter
		this.options = { emitAllStateChanges: options.emitAllStateChanges ?? true, debug: options.debug ?? false }
	}

	private debugLog(message: string, data?: Record<string, unknown>): void {
		if (this.options.debug) {
			debugLog(message, data)
		}
	}

	processMessage(message: ExtensionMessage): void {
		this.debugLog("[MessageProcessor] Received message", { type: message.type })
		try {
			switch (message.type) {
				case "state":
					this.handleStateMessage(message)
					break
				case "messageUpdated":
					this.handleMessageUpdated(message)
					break
				case "action":
					this.debugLog("[MessageProcessor] Action", { action: message.action })
					break
				case "invoke":
					this.debugLog("[MessageProcessor] Invoke", { invoke: message.invoke })
					break
				default:
					this.debugLog("[MessageProcessor] Ignoring message", { type: message.type })
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			debugLog("[MessageProcessor] Error processing message", { error: err.message })
			this.emitter.emit("error", err)
		}
	}

	processMessages(messages: ExtensionMessage[]): void {
		for (const message of messages) {
			this.processMessage(message)
		}
	}

	private handleStateMessage(message: ExtensionMessage): void {
		if (!message.state) {
			this.debugLog("[MessageProcessor] State message missing state payload")
			return
		}
		const { messages, mode } = message.state
		if (mode && typeof mode === "string") {
			const previousMode = this.store.getCurrentMode()
			if (previousMode !== mode) {
				this.debugLog("[MessageProcessor] Mode changed", { from: previousMode, to: mode })
				this.store.setCurrentMode(mode)
				this.emitter.emit("modeChanged", { previousMode, currentMode: mode })
			}
		}
		if (!messages) {
			this.debugLog("[MessageProcessor] State message missing messages")
			return
		}
		const previousState = this.store.getAgentState()
		this.store.setMessages(messages)
		const currentState = this.store.getAgentState()
		this.debugLog("[MessageProcessor] State update", buildStateUpdateInfo(previousState, currentState, messages))
		emitStateChangeEvents(this.emitter, this.options.emitAllStateChanges, previousState, currentState)
		emitNewMessageEvents(this.emitter, messages)
	}

	private handleMessageUpdated(message: ExtensionMessage): void {
		if (message.chatMessage) {
			this.debugLog("[MessageProcessor] messageUpdated with chatMessage", { type: message.chatMessage.type })
			const previousState = this.store.getAgentState()
			this.store.updateMessage(message.chatMessage)
			const currentState = this.store.getAgentState()
			emitStateChangeEvents(this.emitter, this.options.emitAllStateChanges, previousState, currentState)
			return
		}
		if (!message.message) {
			this.debugLog("[MessageProcessor] messageUpdated missing message")
			return
		}
		const notification = message.message
		const previousState = this.store.getAgentState()
		this.store.updateMessage(notification)
		const currentState = this.store.getAgentState()
		this.emitter.emit("messageUpdated", notification)
		emitStateChangeEvents(this.emitter, this.options.emitAllStateChanges, previousState, currentState)
	}

	notifyTaskCleared(): void {
		this.store.clear()
		this.emitter.emit("taskCleared", undefined as void)
	}

	setDebug(enabled: boolean): void {
		this.options.debug = enabled
	}
}
