import { Notification, ChatMessage, ExtensionState } from "@jabberwock/types"

import { detectAgentState } from "../state/agent-state.js"
import type { AgentStateInfo } from "../state/agent-state-types.js"
import { AgentLoopState } from "../state/agent-state-types.js"
import { Observable } from "../events/observable.js"
import { StoreState } from "./state-store-types.js"
import { isChatMessage, createInitialState } from "./state-store-helpers.js"

export class StateStore {
	private state: StoreState
	private stateObservable: Observable<StoreState>
	private agentStateObservable: Observable<AgentStateInfo>
	private stateHistory: StoreState[] = []
	private maxHistorySize: number

	constructor(options: { maxHistorySize?: number } = {}) {
		this.state = createInitialState()
		this.stateObservable = new Observable<StoreState>(this.state)
		this.agentStateObservable = new Observable<AgentStateInfo>(this.state.agentState)
		this.maxHistorySize = options.maxHistorySize ?? 0
	}

	getState(): StoreState {
		return this.state
	}
	getAgentState(): AgentStateInfo {
		return this.state.agentState
	}
	getMessages(): Notification[] {
		return this.state.messages
	}
	getLastMessage(): Notification | undefined {
		return this.state.messages[this.state.messages.length - 1]
	}
	isInitialized(): boolean {
		return this.state.isInitialized
	}
	isWaitingForInput(): boolean {
		return this.state.agentState.isWaitingForInput
	}
	isRunning(): boolean {
		return this.state.agentState.isRunning
	}
	isStreaming(): boolean {
		return this.state.agentState.isStreaming
	}
	getCurrentState(): AgentLoopState {
		return this.state.agentState.state
	}
	getCurrentMode(): string | undefined {
		return this.state.currentMode
	}

	setMessages(messages: Notification[]): AgentStateInfo
	setMessages(messages: ChatMessage[]): AgentStateInfo
	setMessages(messages: Notification[] | ChatMessage[]): AgentStateInfo {
		const previousAgentState = this.state.agentState
		const first = messages[0]
		if (first && isChatMessage(first)) {
			const chatMsgs = messages as ChatMessage[]
			this.updateState({
				...this.state,
				chatMessages: chatMsgs,
				agentState: detectAgentState(chatMsgs),
				isInitialized: true,
				lastUpdatedAt: Date.now(),
			})
		} else {
			const notifs = messages as Notification[]
			this.updateState({
				...this.state,
				messages: notifs,
				agentState: detectAgentState(notifs),
				isInitialized: true,
				lastUpdatedAt: Date.now(),
			})
		}
		return previousAgentState
	}

	addMessage(message: Notification): AgentStateInfo
	addMessage(message: ChatMessage): AgentStateInfo
	addMessage(message: Notification | ChatMessage): AgentStateInfo {
		if (isChatMessage(message)) {
			const previousAgentState = this.state.agentState
			const chatMessages = [...(this.state.chatMessages ?? []), message]
			this.updateState({
				...this.state,
				chatMessages,
				agentState: detectAgentState(chatMessages),
				isInitialized: true,
				lastUpdatedAt: Date.now(),
			})
			return previousAgentState
		}
		const newMessages = [...this.state.messages, message as Notification]
		return this.setMessages(newMessages)
	}

	updateMessage(message: Notification): AgentStateInfo | undefined
	updateMessage(message: ChatMessage): AgentStateInfo | undefined
	updateMessage(message: Notification | ChatMessage): AgentStateInfo | undefined {
		if (isChatMessage(message)) {
			const chatMessages = this.state.chatMessages ?? []
			const index = chatMessages.findIndex((m) => m.ts === message.ts)
			if (index === -1) {
				return this.addMessage(message)
			}
			const previousAgentState = this.state.agentState
			const newChatMessages = [...chatMessages]
			newChatMessages[index] = message
			this.updateState({
				...this.state,
				chatMessages: newChatMessages,
				agentState: detectAgentState(newChatMessages),
				lastUpdatedAt: Date.now(),
			})
			return previousAgentState
		}
		const index = this.state.messages.findIndex((m) => m.ts === message.ts)
		if (index === -1) {
			return this.addMessage(message)
		}
		const newMessages = [...this.state.messages]
		newMessages[index] = message as Notification
		return this.setMessages(newMessages)
	}

	clear(): void {
		this.updateState({
			messages: [],
			agentState: detectAgentState([]),
			isInitialized: true,
			lastUpdatedAt: Date.now(),
			currentMode: this.state.currentMode,
			extensionState: undefined,
		})
	}

	setCurrentMode(mode: string | undefined): void {
		if (this.state.currentMode !== mode) {
			this.updateState({
				...this.state,
				currentMode: mode,
				lastUpdatedAt: Date.now(),
			})
		}
	}

	reset(): void {
		this.state = createInitialState()
		this.stateHistory = []
	}

	setExtensionState(extensionState: Partial<ExtensionState>): void {
		if (extensionState.messages) {
			this.setMessages(extensionState.messages)
		}
		if (extensionState.chatMessages) {
			this.updateState({
				...this.state,
				chatMessages: extensionState.chatMessages,
				agentState: detectAgentState(extensionState.chatMessages),
				isInitialized: true,
				lastUpdatedAt: Date.now(),
				extensionState: { ...this.state.extensionState, ...extensionState },
			})
		} else {
			this.updateState({
				...this.state,
				extensionState: { ...this.state.extensionState, ...extensionState },
			})
		}
	}

	subscribe(observer: (state: StoreState) => void): () => void {
		return this.stateObservable.subscribe(observer)
	}

	subscribeToAgentState(observer: (state: AgentStateInfo) => void): () => void {
		return this.agentStateObservable.subscribe(observer)
	}

	getHistory(): StoreState[] {
		return [...this.stateHistory]
	}

	clearHistory(): void {
		this.stateHistory = []
	}

	private updateState(newState: StoreState): void {
		if (this.maxHistorySize > 0) {
			this.stateHistory.push(this.state)
			if (this.stateHistory.length > this.maxHistorySize) {
				this.stateHistory.shift()
			}
		}
		this.state = newState
		this.stateObservable.next(this.state)
		this.agentStateObservable.next(this.state.agentState)
	}
}
