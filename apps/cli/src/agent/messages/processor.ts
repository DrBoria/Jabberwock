import { ExtensionMessage } from "@jabberwock/types"
import { debugLog } from "@jabberwock/core/cli"

import type { StateStore } from "../store.js"
import type { TypedEventEmitter } from "../events/typed-emitter.js"
import { buildStateUpdateInfo, emitStateChangeEvents, emitNewMessageEvents } from "./events.js"

export interface MessageProcessorOptions {
	emitAllStateChanges?: boolean
	debug?: boolean
}

export function createMessageProcessor(
	store: StateStore,
	emitter: TypedEventEmitter,
	options: MessageProcessorOptions = {},
) {
	const resolvedOptions: Required<MessageProcessorOptions> = {
		emitAllStateChanges: options.emitAllStateChanges ?? true,
		debug: options.debug ?? false,
	}

	function log(message: string, data?: Record<string, unknown>): void {
		if (resolvedOptions.debug) {
			debugLog(message, data)
		}
	}

	function processMessage(message: ExtensionMessage): void {
		log("[MessageProcessor] Received message", { type: message.type })
		try {
			switch (message.type) {
				case "state":
					handleStateMessage(message)
					break
				case "messageUpdated":
					handleMessageUpdated(message)
					break
				case "action":
					log("[MessageProcessor] Action", { action: message.action })
					break
				case "invoke":
					log("[MessageProcessor] Invoke", { invoke: message.invoke })
					break
				default:
					log("[MessageProcessor] Ignoring message", { type: message.type })
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			debugLog("[MessageProcessor] Error processing message", { error: err.message })
			emitter.notify("error", err)
		}
	}

	function processMessages(messages: ExtensionMessage[]): void {
		for (const message of messages) {
			processMessage(message)
		}
	}

	function handleStateMessage(message: ExtensionMessage): void {
		if (!message.state) {
			log("[MessageProcessor] State message missing state payload")
			return
		}
		const { messages, mode } = message.state
		if (mode && typeof mode === "string") {
			const previousMode = store.getCurrentMode()
			if (previousMode !== mode) {
				log("[MessageProcessor] Mode changed", { from: previousMode, to: mode })
				store.setCurrentMode(mode)
				emitter.notify("modeChanged", { previousMode, currentMode: mode })
			}
		}
		if (!messages) {
			log("[MessageProcessor] State message missing messages")
			return
		}
		const previousState = store.getAgentState()
		store.setMessages(messages)
		const currentState = store.getAgentState()
		log("[MessageProcessor] State update", buildStateUpdateInfo(previousState, currentState, messages))
		emitStateChangeEvents(emitter, resolvedOptions.emitAllStateChanges, previousState, currentState)
		emitNewMessageEvents(emitter, messages)
	}

	function handleMessageUpdated(message: ExtensionMessage): void {
		if (message.chatMessage) {
			log("[MessageProcessor] messageUpdated with chatMessage", { type: message.chatMessage.type })
			const previousState = store.getAgentState()
			store.updateMessage(message.chatMessage)
			const currentState = store.getAgentState()
			emitStateChangeEvents(emitter, resolvedOptions.emitAllStateChanges, previousState, currentState)
			return
		}
		if (!message.message) {
			log("[MessageProcessor] messageUpdated missing message")
			return
		}
		const notification = message.message
		const previousState = store.getAgentState()
		store.updateMessage(notification)
		const currentState = store.getAgentState()
		emitter.notify("messageUpdated", notification)
		emitStateChangeEvents(emitter, resolvedOptions.emitAllStateChanges, previousState, currentState)
	}

	function notifyTaskCleared(): void {
		store.clear()
		emitter.notify("taskCleared", undefined as void)
	}

	function setDebug(enabled: boolean): void {
		resolvedOptions.debug = enabled
	}

	return { processMessage, processMessages, notifyTaskCleared, setDebug }
}

/** MessageProcessor instance type */
export type MessageProcessor = ReturnType<typeof createMessageProcessor>
