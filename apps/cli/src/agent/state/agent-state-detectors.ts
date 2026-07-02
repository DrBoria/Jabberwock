import {
	Notification,
	ChatMessage,
	isIdleAsk,
	isResumableAsk,
	isInteractiveAsk,
	isNonBlockingAsk,
} from "@jabberwock/types"

import { AgentLoopState } from "./agent-state-types.js"
import type { AgentStateInfo } from "./agent-state-types.js"
import { isApiRequestInProgress, getRequiredAction, getStateDescription } from "./agent-state-helpers.js"

/**
 * Build state info for ChatMessage[] (simple conversation records).
 */
export function detectFromChatMessages(lastMessage: ChatMessage, lastMessageTs: number | undefined): AgentStateInfo {
	const description = getStateDescription(AgentLoopState.RUNNING)
	if (lastMessage.type === "agent") {
		return {
			state: AgentLoopState.IDLE,
			isWaitingForInput: false,
			isRunning: false,
			isStreaming: false,
			requiredAction: lastMessage.finishReason === "completed" ? "start_task" : "retry_or_new_task",
			lastMessageTs,
			description: getStateDescription(AgentLoopState.IDLE),
		}
	}
	return {
		state: AgentLoopState.RUNNING,
		isWaitingForInput: false,
		isRunning: true,
		isStreaming: false,
		requiredAction: "none",
		lastMessageTs,
		description,
	}
}

/**
 * Build state info for Notification[] (detailed ask/say state).
 */
export function detectFromNotificationMessages(lastMessage: Notification, messages: Notification[]): AgentStateInfo {
	if (lastMessage.partial === true) {
		return {
			state: AgentLoopState.STREAMING,
			isWaitingForInput: false,
			isRunning: true,
			isStreaming: true,
			currentAsk: lastMessage.ask,
			requiredAction: "none",
			lastMessageTs: lastMessage.ts,
			lastMessage,
			description: getStateDescription(AgentLoopState.STREAMING),
		}
	}
	if (lastMessage.type === "ask" && lastMessage.ask) {
		if (isNonBlockingAsk(lastMessage.ask)) {
			return {
				state: AgentLoopState.RUNNING,
				isWaitingForInput: false,
				isRunning: true,
				isStreaming: false,
				currentAsk: lastMessage.ask,
				requiredAction: "continue_or_abort",
				lastMessageTs: lastMessage.ts,
				lastMessage,
				description: "Command is running. You can continue or abort.",
			}
		}
		if (isIdleAsk(lastMessage.ask)) {
			return {
				state: AgentLoopState.IDLE,
				isWaitingForInput: true,
				isRunning: false,
				isStreaming: false,
				currentAsk: lastMessage.ask,
				requiredAction: getRequiredAction(lastMessage.ask),
				lastMessageTs: lastMessage.ts,
				lastMessage,
				description: getStateDescription(AgentLoopState.IDLE, lastMessage.ask),
			}
		}
		if (isResumableAsk(lastMessage.ask)) {
			return {
				state: AgentLoopState.RESUMABLE,
				isWaitingForInput: true,
				isRunning: false,
				isStreaming: false,
				currentAsk: lastMessage.ask,
				requiredAction: getRequiredAction(lastMessage.ask),
				lastMessageTs: lastMessage.ts,
				lastMessage,
				description: getStateDescription(AgentLoopState.RESUMABLE, lastMessage.ask),
			}
		}
		if (isInteractiveAsk(lastMessage.ask)) {
			return {
				state: AgentLoopState.WAITING_FOR_INPUT,
				isWaitingForInput: true,
				isRunning: false,
				isStreaming: false,
				currentAsk: lastMessage.ask,
				requiredAction: getRequiredAction(lastMessage.ask),
				lastMessageTs: lastMessage.ts,
				lastMessage,
				description: getStateDescription(AgentLoopState.WAITING_FOR_INPUT, lastMessage.ask),
			}
		}
	}
	if (isApiRequestInProgress(messages)) {
		return {
			state: AgentLoopState.STREAMING,
			isWaitingForInput: false,
			isRunning: true,
			isStreaming: true,
			requiredAction: "none",
			lastMessageTs: lastMessage.ts,
			lastMessage,
			description: getStateDescription(AgentLoopState.STREAMING),
		}
	}
	return {
		state: AgentLoopState.RUNNING,
		isWaitingForInput: false,
		isRunning: true,
		isStreaming: false,
		requiredAction: "none",
		lastMessageTs: lastMessage.ts,
		lastMessage,
		description: getStateDescription(AgentLoopState.RUNNING),
	}
}
