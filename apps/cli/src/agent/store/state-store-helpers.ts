import type { Notification, ChatMessage } from "@jabberwock/types"

import { detectAgentState } from "../state/agent-state.js"
import type { StoreState } from "./state-store-types.js"

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
