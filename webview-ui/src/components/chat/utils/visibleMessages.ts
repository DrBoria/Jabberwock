import type { ClineMessage } from "@jabberwock/types"

/**
 * Visibility rules for "say" type messages.
 * true = visible, false = hidden.
 */
const sayVisibilityMap: Partial<Record<string, boolean>> = {
	api_req_started: false,
	api_req_finished: false,
	api_req_retry_delayed: false,
	mcp_server_request_started: false,
	mcp_server_response: false,
	checkpoint_saved: false,
}

/**
 * Visibility rules for "ask" type messages.
 * true = visible, false = hidden.
 */
const askVisibilityMap: Partial<Record<string, boolean>> = {
	interactive_app: false,
}

/**
 * Determines if a "say" message is visible.
 * Handles special cases like api_req_rate_limit_wait and command_output.
 */
function isSayVisible(message: ClineMessage): boolean {
	const sayType = message.say

	// Check static visibility map first
	const staticVisibility = sayVisibilityMap[sayType ?? ""]
	if (staticVisibility !== undefined) return staticVisibility

	// Special case: api_req_rate_limit_wait — visible only if unresolved
	if (sayType === "api_req_rate_limit_wait" && message.text) {
		try {
			const parsed = JSON.parse(message.text)
			if (parsed.isResolved) return false
		} catch {
			// malformed JSON, show it
		}
		return true
	}

	// Special case: command_output — hide empty output
	if (sayType === "command_output" && message.text === "") return false

	// Default: visible
	return true
}

/**
 * Determines if an "ask" message is visible.
 */
function isAskVisible(message: ClineMessage): boolean {
	const askType = message.ask
	const staticVisibility = askVisibilityMap[askType ?? ""]
	return staticVisibility !== undefined ? staticVisibility : true
}

/**
 * Collects checkpoint hashes from modifiedMessages for deduplication.
 */
function collectCheckpointHashes(modifiedMessages: ClineMessage[]): Set<string> {
	const hashes = new Set<string>()
	for (const msg of modifiedMessages) {
		if (msg.type === "say" && msg.say === "checkpoint_saved" && msg.text) {
			try {
				const parsed = JSON.parse(msg.text)
				if (parsed.hash) hashes.add(parsed.hash)
			} catch {
				// ignore malformed JSON
			}
		}
	}
	return hashes
}

/**
 * Removes duplicate checkpoint_saved messages that follow user_feedback with the same hash.
 */
function deduplicateCheckpoints(messages: ClineMessage[], checkpointHashes: Set<string>): ClineMessage[] {
	const result = [...messages]
	for (let i = 1; i < result.length; i++) {
		const msg = result[i]
		if (msg.type === "say" && msg.say === "checkpoint_saved" && msg.text) {
			try {
				const parsed = JSON.parse(msg.text)
				if (parsed.hash && checkpointHashes.has(parsed.hash)) {
					const prevMsg = result[i - 1]
					if (prevMsg.type === "say" && prevMsg.say === "user_feedback" && prevMsg.text === parsed.hash) {
						result.splice(i, 1)
						i--
					}
				}
			} catch {
				// ignore
			}
		}
	}
	return result
}

/**
 * Filters messages to only show visible ones.
 * Uses object-based visibility maps instead of switch statements.
 *
 * @param modifiedMessages - Messages after API request combining and command sequence combining
 * @returns Filtered visible messages
 */
export function computeVisibleMessages(modifiedMessages: ClineMessage[]): ClineMessage[] {
	const checkpointHashes = collectCheckpointHashes(modifiedMessages)

	const visible = modifiedMessages.filter((message) => {
		if (message.type === "say") return isSayVisible(message)
		if (message.type === "ask") return isAskVisible(message)
		return true
	})

	return deduplicateCheckpoints(visible, checkpointHashes)
}
