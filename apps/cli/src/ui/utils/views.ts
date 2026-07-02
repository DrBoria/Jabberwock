import type { TUIMessage, PendingAsk, View } from "../types.js"

/**
 * Determine the current view state based on messages and pending asks
 */
export function getView(messages: TUIMessage[], pendingAsk: PendingAsk | null, isLoading: boolean): View {
	if (pendingAsk) {
		return "UserInput"
	}

	if (messages.length === 0) {
		return "UserInput"
	}

	const lastMessage = messages.at(-1)
	if (!lastMessage) {
		return "UserInput"
	}

	if (lastMessage.role === "user" || lastMessage.role === "tool") {
		return "AgentResponse"
	}

	if (lastMessage.role === "assistant") {
		if (lastMessage.hasPendingToolCalls) {
			return "ToolUse"
		}
		return isLoading ? "AgentResponse" : "UserInput"
	}

	return "Default"
}
