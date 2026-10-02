import { Notification, ChatMessage, ExtensionState } from "@jabberwock/types"

import { detectAgentState } from "./state/agent-state.js"
import type { AgentStateInfo } from "./state/types.js"
import { AgentLoopState } from "./state/types.js"
import { createObservable } from "./events/observable.js"

/**
 * The complete state managed by the store.
 */
export interface StoreState {
	/**
	 * The array of messages from "the" extension.
	 * This is the primary data used to compute agent state.
	 */
	messages: Notification[]

	/**
	 * Optional ChatMessage array from "the" task context.
	 * Used alongside `messages` during the Notification → ChatMessage migration.
	 * @deprecated Eventually replaces `messages` once all consumers migrate to ChatMessage.
	 */
	chatMessages?: ChatMessage[]

	/**
	 * The computed agent state info.
	 * Updated automatically when messages change.
	 */
	agentState: AgentStateInfo

	/**
	 * Whether we have received any state from "the" extension.
	 * Useful to distinguish "no task" from "not yet connected".
	 */
	isInitialized: boolean

	/**
	 * The last time state was updated.
	 */
	lastUpdatedAt: number

	/**
	 * The current mode (e.g., "code", "architect", "ask").
	 * Tracked from "state" messages received from "the" extension.
	 */
	currentMode: string | undefined

	/**
	 * Optional: Cache of extension state fields we might need.
	 * This is a subset of the full ExtensionState.
	 */
	extensionState?: Partial<ExtensionState>
}

/**
 * Type guard: Check if a message is a ChatMessage by its discriminant.
 */
export function isChatMessage(msg: Notification | ChatMessage): msg is ChatMessage {
	return msg.type === "agent" || msg.type === "user" || msg.type === "mcp_tool" || msg.type === "system"
}

/**
 * Create the initial store state.
 */
export function createInitialState(): StoreState {
	return {
		messages: [],
		agentState: detectAgentState([]),
		isInitialized: false,
		lastUpdatedAt: Date.now(),
		currentMode: undefined,
	}
}

export function createStateStore(options: { maxHistorySize?: number } = {}) {
	let state = createInitialState()
	const stateObservable = createObservable<StoreState>(state)
	const agentStateObservable = createObservable<AgentStateInfo>(state.agentState)
	let stateHistory: StoreState[] = []
	const maxHistorySize = options.maxHistorySize ?? 0

	function getState(): StoreState {
		return state
	}
	function getAgentState(): AgentStateInfo {
		return state.agentState
	}
	function getMessages(): Notification[] {
		return state.messages
	}
	function getLastMessage(): Notification | undefined {
		return state.messages[state.messages.length - 1]
	}
	function isInitialized(): boolean {
		return state.isInitialized
	}
	function isWaitingForInput(): boolean {
		return state.agentState.isWaitingForInput
	}
	function isRunning(): boolean {
		return state.agentState.isRunning
	}
	function isStreaming(): boolean {
		return state.agentState.isStreaming
	}
	function getCurrentState(): AgentLoopState {
		return state.agentState.state
	}
	function getCurrentMode(): string | undefined {
		return state.currentMode
	}

	function setMessages(messages: Notification[]): AgentStateInfo
	function setMessages(messages: ChatMessage[]): AgentStateInfo
	function setMessages(messages: Notification[] | ChatMessage[]): AgentStateInfo {
		const previousAgentState = state.agentState
		const first = messages[0]
		if (first && isChatMessage(first)) {
			const chatMsgs = messages as ChatMessage[]
			updateState({
				...state,
				chatMessages: chatMsgs,
				agentState: detectAgentState(chatMsgs),
				isInitialized: true,
				lastUpdatedAt: Date.now(),
			})
		} else {
			const notifs = messages as Notification[]
			updateState({
				...state,
				messages: notifs,
				agentState: detectAgentState(notifs),
				isInitialized: true,
				lastUpdatedAt: Date.now(),
			})
		}
		return previousAgentState
	}

	function addMessage(message: Notification): AgentStateInfo
	function addMessage(message: ChatMessage): AgentStateInfo
	function addMessage(message: Notification | ChatMessage): AgentStateInfo {
		if (isChatMessage(message)) {
			const previousAgentState = state.agentState
			const chatMessages = [...(state.chatMessages ?? []), message]
			updateState({
				...state,
				chatMessages,
				agentState: detectAgentState(chatMessages),
				isInitialized: true,
				lastUpdatedAt: Date.now(),
			})
			return previousAgentState
		}
		const newMessages = [...state.messages, message as Notification]
		return setMessages(newMessages)
	}

	function updateMessage(message: Notification): AgentStateInfo | undefined
	function updateMessage(message: ChatMessage): AgentStateInfo | undefined
	function updateMessage(message: Notification | ChatMessage): AgentStateInfo | undefined {
		if (isChatMessage(message)) {
			const chatMessages = state.chatMessages ?? []
			const index = chatMessages.findIndex((m) => m.ts === message.ts)
			if (index === -1) {
				return addMessage(message)
			}
			const previousAgentState = state.agentState
			const newChatMessages = [...chatMessages]
			newChatMessages[index] = message
			updateState({
				...state,
				chatMessages: newChatMessages,
				agentState: detectAgentState(newChatMessages),
				lastUpdatedAt: Date.now(),
			})
			return previousAgentState
		}
		const index = state.messages.findIndex((m) => m.ts === message.ts)
		if (index === -1) {
			return addMessage(message)
		}
		const newMessages = [...state.messages]
		newMessages[index] = message as Notification
		return setMessages(newMessages)
	}

	function clear(): void {
		updateState({
			messages: [],
			agentState: detectAgentState([]),
			isInitialized: true,
			lastUpdatedAt: Date.now(),
			currentMode: state.currentMode,
			extensionState: undefined,
		})
	}

	function setCurrentMode(mode: string | undefined): void {
		if (state.currentMode !== mode) {
			updateState({
				...state,
				currentMode: mode,
				lastUpdatedAt: Date.now(),
			})
		}
	}

	function reset(): void {
		state = createInitialState()
		stateHistory = []
	}

	function setExtensionState(extensionState: Partial<ExtensionState>): void {
		if (extensionState.messages) {
			setMessages(extensionState.messages)
		}
		if (extensionState.chatMessages) {
			updateState({
				...state,
				chatMessages: extensionState.chatMessages,
				agentState: detectAgentState(extensionState.chatMessages),
				isInitialized: true,
				lastUpdatedAt: Date.now(),
				extensionState: { ...state.extensionState, ...extensionState },
			})
		} else {
			updateState({
				...state,
				extensionState: { ...state.extensionState, ...extensionState },
			})
		}
	}

	function subscribe(observer: (state: StoreState) => void): () => void {
		return stateObservable.subscribe(observer)
	}

	function subscribeToAgentState(observer: (state: AgentStateInfo) => void): () => void {
		return agentStateObservable.subscribe(observer)
	}

	function getHistory(): StoreState[] {
		return [...stateHistory]
	}

	function clearHistory(): void {
		stateHistory = []
	}

	function updateState(newState: StoreState): void {
		if (maxHistorySize > 0) {
			stateHistory.push(state)
			if (stateHistory.length > maxHistorySize) {
				stateHistory.shift()
			}
		}
		state = newState
		stateObservable.next(state)
		agentStateObservable.next(state.agentState)
	}

	return {
		getState,
		getAgentState,
		getMessages,
		getLastMessage,
		isInitialized,
		isWaitingForInput,
		isRunning,
		isStreaming,
		getCurrentState,
		getCurrentMode,
		setMessages,
		addMessage,
		updateMessage,
		clear,
		setCurrentMode,
		reset,
		setExtensionState,
		subscribe,
		subscribeToAgentState,
		getHistory,
		clearHistory,
	}
}

/** StateStore instance type */
export type StateStore = ReturnType<typeof createStateStore>
