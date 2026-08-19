import { Anthropic } from "@anthropic-ai/sdk"

import { CachePointPlacement } from "@api/transform/cache-strategy/types"

export function computeMessagesTokenSpan(
	messages: Anthropic.Messages.MessageParam[],
	estimateTokenCount: (msg: Anthropic.Messages.MessageParam) => number,
	fromIndex: number,
	toIndex: number,
): number {
	return messages.slice(fromIndex, toIndex + 1).reduce((acc, curr) => acc + estimateTokenCount(curr), 0)
}

export function filterValidPlacements(placements: CachePointPlacement[], totalMessages: number): CachePointPlacement[] {
	return placements.filter((p) => p.index < totalMessages)
}

export function computeTokensBetweenPlacements(
	messages: Anthropic.Messages.MessageParam[],
	estimateTokenCount: (msg: Anthropic.Messages.MessageParam) => number,
	placements: CachePointPlacement[],
): number[] {
	const result: number[] = []
	let startIdx = 0

	for (const placement of placements) {
		const tokens = computeMessagesTokenSpan(messages, estimateTokenCount, startIdx, placement.index)
		result.push(tokens)
		startIdx = placement.index + 1
	}

	return result
}

export function findSmallestGapIndex(tokensBetweenPlacements: number[]): number {
	let smallestGapIndex = 0
	let smallestGap = Number.MAX_VALUE

	for (let i = 0; i < tokensBetweenPlacements.length - 1; i++) {
		const gap = tokensBetweenPlacements[i] + tokensBetweenPlacements[i + 1]
		if (gap < smallestGap) {
			smallestGap = gap
			smallestGapIndex = i
		}
	}

	return smallestGapIndex
}

/**
 * Find the optimal placement for a cache point within a specified range of messages
 * Simply finds the last user message in the range
 */
export function findOptimalPlacementForRange(
	messages: Anthropic.Messages.MessageParam[],
	estimateTokenCount: (msg: Anthropic.Messages.MessageParam) => number,
	previousPlacements: CachePointPlacement[],
	startIndex: number,
	endIndex: number,
	minTokensPerPoint: number,
): CachePointPlacement | null {
	if (startIndex >= endIndex) {
		return null
	}

	// Find the last user message in the range
	let lastUserMessageIndex = -1
	for (let i = endIndex; i >= startIndex; i--) {
		if (messages[i].role === "user") {
			lastUserMessageIndex = i
			break
		}
	}

	if (lastUserMessageIndex >= 0) {
		// Calculate the total tokens covered from the previous cache point (or start of conversation)
		// to this cache point. This ensures tokensCovered represents the full span of tokens
		// that will be cached by this cache point.
		let totalTokensCovered = 0

		// Find the previous cache point index
		let previousCachePointIndex = -1

		for (const placement of previousPlacements) {
			if (placement.index < startIndex && placement.index > previousCachePointIndex) {
				previousCachePointIndex = placement.index
			}
		}

		// Calculate tokens from previous cache point (or start) to this cache point
		const tokenStartIndex = previousCachePointIndex + 1
		totalTokensCovered = messages
			.slice(tokenStartIndex, lastUserMessageIndex + 1)
			.reduce((acc, curr) => acc + estimateTokenCount(curr), 0)

		// Guard clause: ensure we have enough tokens to justify a cache point
		if (totalTokensCovered < minTokensPerPoint) {
			return null
		}
		return {
			index: lastUserMessageIndex,
			type: "message" as const,
			tokensCovered: totalTokensCovered,
		}
	}

	return null
}
