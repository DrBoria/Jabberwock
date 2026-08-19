import type { ITaskModel } from "@features/chat/task/store"

/**
 * Shared utility to find message indices based on timestamp.
 * When multiple messages share the same timestamp (e.g., after condense),
 * this function prefers non-summary messages to ensure user operations
 * target the intended message rather than the summary.
 */
export function findMessageIndices(messageTs: number, currentCline: ITaskModel) {
	const messageIndex = currentCline.messages.findIndex((msg: { ts: number }) => msg.ts === messageTs)

	const allApiMatches = currentCline.apiConversationHistory
		.map((msg, idx) => ({ msg, idx }))
		.filter(({ msg }) => msg.ts === messageTs)

	const preferred = allApiMatches.find(({ msg }) => !msg.isSummary) || allApiMatches[0]
	const apiConversationHistoryIndex = preferred?.idx ?? -1

	return { messageIndex, apiConversationHistoryIndex }
}

/**
 * Fallback: find first API history index at or after a timestamp.
 */
export function findFirstApiIndexAtOrAfter(ts: number, currentCline: ITaskModel) {
	if (typeof ts !== "number") return -1
	return currentCline.apiConversationHistory.findIndex((msg) => typeof msg?.ts === "number" && msg.ts >= ts)
}
