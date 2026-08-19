import type { Notification } from "@jabberwock/types"

/**
 * Consolidates API request start and finish messages in an array of ClineMessages.
 *
 * This function looks for pairs of 'api_req_started' and 'api_req_finished' messages.
 * When it finds a pair, it consolidates them into a single message.
 * The JSON data in the text fields of both messages are merged.
 *
 * @param messages - An array of Notification objects to process.
 * @returns A new array of Notification objects with API requests consolidated.
 *
 * @example
 * const messages = [
 *   { type: "say", say: "api_req_started", text: '{"request":"GET /api/data"}', ts: 1000 },
 *   { type: "say", say: "api_req_finished", text: '{"cost":0.005}', ts: 1001 }
 * ];
 * const result = consolidateApiRequests(messages);
 * // Result: [{ type: "say", say: "api_req_started", text: '{"request":"GET /api/data","cost":0.005}', ts: 1000 }]
 */
export function consolidateApiRequests(messages: Notification[]): Notification[] {
	if (messages.length === 0) {
		return []
	}

	if (messages.length === 1) {
		return messages
	}

	if (!needsMerge(messages)) {
		return messages
	}

	const result: Notification[] = []
	const startedIndices: number[] = []

	for (const message of messages) {
		if (message.type !== "say" || (message.say !== "api_req_started" && message.say !== "api_req_finished")) {
			result.push(message)
			continue
		}

		if (message.say === "api_req_started") {
			result.push(message)
			startedIndices.push(result.length - 1)
			continue
		}

		mergeApiReqFinished(result, startedIndices, message)
	}

	return result
}

function needsMerge(messages: Notification[]): boolean {
	for (const msg of messages) {
		if (msg.type === "say" && (msg.say === "api_req_started" || msg.say === "api_req_finished")) {
			return true
		}
	}
	return false
}

function mergeApiReqFinished(result: Notification[], startedIndices: number[], message: Notification): void {
	const startIndex = startedIndices.length > 0 ? startedIndices.pop() : undefined

	if (startIndex === undefined) return

	const startMessage = result[startIndex]
	if (!startMessage) return

	let startData: Record<string, unknown> = {}
	let finishData: Record<string, unknown> = {}

	try {
		if (startMessage.text) {
			startData = JSON.parse(startMessage.text) as Record<string, unknown>
		}
	} catch {
		// Ignore JSON parse errors
	}

	try {
		if (message.text) {
			finishData = JSON.parse(message.text) as Record<string, unknown>
		}
	} catch {
		// Ignore JSON parse errors
	}

	result[startIndex] = { ...startMessage, text: JSON.stringify({ ...startData, ...finishData }) }
}
