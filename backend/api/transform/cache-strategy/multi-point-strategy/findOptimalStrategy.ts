import { CachePointPlacement, CacheStrategyConfig } from "@api/transform/cache-strategy/types"
import { logger } from "@utils/logging"

import {
	computeMessagesTokenSpan,
	filterValidPlacements,
	computeTokensBetweenPlacements,
	findSmallestGapIndex,
} from "./multi-point-placement"
import { placeInitialCachePoints, keepAllPreviousAndAddNew, combineSmallestGapAndAddNew } from "./buildCachePoints"

export function determineMessageCachePoints(
	config: CacheStrategyConfig,
	estimateTokenCount: (message: unknown) => number,
	minTokensPerPoint: number,
	remainingCachePoints: number,
): CachePointPlacement[] {
	if (config.messages.length <= 1) {
		return []
	}

	const totalMessages = config.messages.length
	const previousPlacements = config.previousCachePointPlacements || []

	if (previousPlacements.length === 0) {
		return placeInitialCachePoints(
			config,
			estimateTokenCount,
			minTokensPerPoint,
			remainingCachePoints,
			totalMessages,
		)
	}

	const lastPreviousIndex = previousPlacements[previousPlacements.length - 1].index
	const newMessagesTokens = computeMessagesTokenSpan(
		config.messages,
		estimateTokenCount,
		lastPreviousIndex + 1,
		totalMessages - 1,
	)

	if (newMessagesTokens < minTokensPerPoint) {
		return filterValidPlacements(previousPlacements, totalMessages)
	}

	if (remainingCachePoints > previousPlacements.length) {
		return keepAllPreviousAndAddNew(
			config,
			estimateTokenCount,
			previousPlacements,
			lastPreviousIndex,
			totalMessages,
			minTokensPerPoint,
		)
	}

	const tokensBetweenPlacements = computeTokensBetweenPlacements(
		config.messages,
		estimateTokenCount,
		previousPlacements,
	)
	const smallestGapIndex = findSmallestGapIndex(tokensBetweenPlacements)
	const smallestGap = tokensBetweenPlacements[smallestGapIndex] + tokensBetweenPlacements[smallestGapIndex + 1]

	const requiredTokenThreshold = smallestGap * 1.2

	if (newMessagesTokens >= requiredTokenThreshold) {
		logger.info("Combining cache points is beneficial", {
			ctx: "cache-strategy",
			newMessagesTokens,
			smallestGap,
			requiredTokenThreshold,
			action: "combining_cache_points",
		})

		return combineSmallestGapAndAddNew(
			config,
			estimateTokenCount,
			previousPlacements,
			smallestGapIndex,
			totalMessages,
			minTokensPerPoint,
			lastPreviousIndex,
			remainingCachePoints,
		)
	}

	logger.info("Combining cache points is not beneficial", {
		ctx: "cache-strategy",
		newMessagesTokens,
		smallestGap,
		requiredTokenThreshold,
		action: "keeping_existing_cache_points",
	})

	return filterValidPlacements(previousPlacements, totalMessages)
}
