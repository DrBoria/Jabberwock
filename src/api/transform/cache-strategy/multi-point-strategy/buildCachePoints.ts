import { CachePointPlacement, CacheStrategyConfig } from "@api/transform/cache-strategy/types"
import { filterValidPlacements, findOptimalPlacementForRange } from "./multi-point-placement"

export function placeInitialCachePoints(
	config: CacheStrategyConfig,
	estimateTokenCount: (message: unknown) => number,
	minTokensPerPoint: number,
	remainingCachePoints: number,
	totalMessages: number,
): CachePointPlacement[] {
	const placements: CachePointPlacement[] = []
	let currentIndex = 0

	while (currentIndex < totalMessages && remainingCachePoints > 0) {
		const newPlacement = findOptimalPlacementForRange(
			config.messages,
			estimateTokenCount,
			[],
			currentIndex,
			totalMessages - 1,
			minTokensPerPoint,
		)

		if (newPlacement) {
			placements.push(newPlacement)
			currentIndex = newPlacement.index + 1
			remainingCachePoints--
		} else break
	}

	return placements
}

export function keepAllPreviousAndAddNew(
	config: CacheStrategyConfig,
	estimateTokenCount: (message: unknown) => number,
	previousPlacements: CachePointPlacement[],
	lastPreviousIndex: number,
	totalMessages: number,
	minTokensPerPoint: number,
): CachePointPlacement[] {
	const placements = filterValidPlacements(previousPlacements, totalMessages)

	const newPlacement = findOptimalPlacementForRange(
		config.messages,
		estimateTokenCount,
		previousPlacements,
		lastPreviousIndex + 1,
		totalMessages - 1,
		minTokensPerPoint,
	)

	if (newPlacement) {
		placements.push(newPlacement)
	}

	return placements
}

export function combineSmallestGapAndAddNew(
	config: CacheStrategyConfig,
	estimateTokenCount: (message: unknown) => number,
	previousPlacements: CachePointPlacement[],
	smallestGapIndex: number,
	totalMessages: number,
	minTokensPerPoint: number,
	lastPreviousIndex: number,
	remainingCachePoints: number,
): CachePointPlacement[] {
	const placements: CachePointPlacement[] = []

	for (let i = 0; i < previousPlacements.length; i++) {
		if (i !== smallestGapIndex && i !== smallestGapIndex + 1) {
			if (previousPlacements[i].index < totalMessages) {
				placements.push(previousPlacements[i])
			}
		} else if (i === smallestGapIndex) {
			const startOfRange = i === 0 ? 0 : previousPlacements[i - 1].index + 1
			const combinedPlacement = findOptimalPlacementForRange(
				config.messages,
				estimateTokenCount,
				previousPlacements,
				startOfRange,
				previousPlacements[i + 1].index,
				minTokensPerPoint,
			)

			if (combinedPlacement) {
				placements.push(combinedPlacement)
			}

			i++
		}
	}

	if (placements.length < remainingCachePoints) {
		const newPlacement = findOptimalPlacementForRange(
			config.messages,
			estimateTokenCount,
			previousPlacements,
			lastPreviousIndex + 1,
			totalMessages - 1,
			minTokensPerPoint,
		)

		if (newPlacement) {
			placements.push(newPlacement)
		}
	}

	return placements
}
