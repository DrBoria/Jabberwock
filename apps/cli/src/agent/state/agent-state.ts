/**
 * Agent Loop State Detection
 *
 * This module provides the core logic for detecting the current state of the
 * Jabberwock agent loop. The state is determined by analyzing the messages
 * array, specifically the last message's type and properties.
 *
 * Key insight: The agent loop stops whenever a message with `type: "ask"` arrives,
 * and the specific `ask` value determines what kind of response the agent is waiting for.
 */

import type { Notification, ChatMessage } from "@jabberwock/types"

import type { AgentStateInfo } from "./agent-state-types.js"
import { AgentLoopState } from "./agent-state-types.js"
import { getStateDescription } from "./agent-state-helpers.js"
import { detectFromChatMessages, detectFromNotificationMessages } from "./agent-state-detectors.js"

/**
 * Detect the current state of the agent loop from the messages array.
 */
export function detectAgentState(messages: ChatMessage[]): AgentStateInfo
export function detectAgentState(messages: Notification[]): AgentStateInfo
export function detectAgentState(messages: Notification[] | ChatMessage[]): AgentStateInfo
export function detectAgentState(messages: Notification[] | ChatMessage[]): AgentStateInfo {
	const lastMessage = messages?.[messages.length - 1]
	if (!lastMessage) {
		return {
			state: AgentLoopState.NO_TASK,
			isWaitingForInput: false,
			isRunning: false,
			isStreaming: false,
			requiredAction: "start_new_task",
			description: getStateDescription(AgentLoopState.NO_TASK),
		}
	}
	if (
		lastMessage.type === "agent" ||
		lastMessage.type === "user" ||
		lastMessage.type === "mcp_tool" ||
		lastMessage.type === "system"
	) {
		return detectFromChatMessages(lastMessage as ChatMessage, lastMessage.ts)
	}
	return detectFromNotificationMessages(lastMessage as Notification, messages as Notification[])
}

/**
 * Quick check: Is the agent waiting for user input?
 */
export function isAgentWaitingForInput(messages: Notification[]): boolean
export function isAgentWaitingForInput(messages: ChatMessage[]): boolean
export function isAgentWaitingForInput(messages: Notification[] | ChatMessage[]): boolean {
	return detectAgentState(messages).isWaitingForInput
}

/**
 * Quick check: Is the agent actively running (not waiting)?
 */
export function isAgentRunning(messages: Notification[]): boolean
export function isAgentRunning(messages: ChatMessage[]): boolean
export function isAgentRunning(messages: Notification[] | ChatMessage[]): boolean {
	const state = detectAgentState(messages)
	return state.isRunning && !state.isWaitingForInput
}

/**
 * Quick check: Is content currently streaming?
 */
export function isContentStreaming(messages: Notification[]): boolean
export function isContentStreaming(messages: ChatMessage[]): boolean
export function isContentStreaming(messages: Notification[] | ChatMessage[]): boolean {
	return detectAgentState(messages).isStreaming
}
