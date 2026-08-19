import type { ExtensionMessage, Notification, ChatMessage } from "@jabberwock/types"

/**
 * Check if a message is a valid ChatMessage.
 */
export function isValidChatMessage(message: unknown): message is ChatMessage {
	if (!message || typeof message !== "object") {
		return false
	}
	const msg = message as Record<string, unknown>
	if (typeof msg.ts !== "number") {
		return false
	}
	if (msg.type !== "agent" && msg.type !== "user" && msg.type !== "mcp_tool" && msg.type !== "system") {
		return false
	}
	return true
}

/**
 * Check if a message is a valid Notification (Cline message).
 */
export function isValidClineMessage(message: unknown): message is Notification {
	if (!message || typeof message !== "object") {
		return false
	}
	const msg = message as Record<string, unknown>
	if (typeof msg.ts !== "number") {
		return false
	}
	if (msg.type !== "ask" && msg.type !== "say") {
		return false
	}
	return true
}

/**
 * Check if a message is a valid ExtensionMessage.
 */
export function isValidExtensionMessage(message: unknown): message is ExtensionMessage {
	if (!message || typeof message !== "object") {
		return false
	}
	const msg = message as Record<string, unknown>
	if (typeof msg.type !== "string") {
		return false
	}
	return true
}

/**
 * Parse an ExtensionMessage from a JSON string.
 */
export function parseExtensionMessage(json: string): ExtensionMessage | undefined {
	try {
		const parsed = JSON.parse(json)
		if (isValidExtensionMessage(parsed)) {
			return parsed
		}
		return undefined
	} catch {
		return undefined
	}
}

/**
 * Parse the api_req_started text field from a Notification.
 */
export function parseApiReqStartedText(message: Notification): { cost?: number } | undefined {
	if (message.say !== "api_req_started" || !message.text) {
		return undefined
	}
	try {
		return JSON.parse(message.text)
	} catch {
		return undefined
	}
}
