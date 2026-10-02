import { SystemContentBlock } from "@aws-sdk/client-bedrock-runtime"

import { createCacheStrategyBase } from "@api/transform/cache-strategy/base-strategy"
import { CacheResult, CacheStrategyConfig } from "@api/transform/cache-strategy/types"
import { determineMessageCachePoints } from "./findOptimalStrategy"

import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Strategy for handling multiple cache points.
 * Creates cache points after messages as soon as uncached tokens exceed minimumTokenCount.
 *
 * @param config - Strategy configuration
 */
export function MultiPointStrategy(config: CacheStrategyConfig) {
	const base = createCacheStrategyBase(config)

	function formatWithoutCachePoints(): CacheResult {
		const systemBlocks: SystemContentBlock[] = config.systemPrompt
			? [{ text: config.systemPrompt } as SystemContentBlock]
			: []

		return base.formatResult(systemBlocks, base.messagesToContentBlocks(config.messages))
	}

	return {
		/**
		 * Determine optimal cache point placements and return the formatted result
		 */
		determineOptimalCachePoints(): CacheResult {
			if (!config.usePromptCache || config.messages.length === 0) {
				return formatWithoutCachePoints()
			}

			const supportsSystemCache = config.modelInfo.cachableFields.includes("system")
			const supportsMessageCache = config.modelInfo.cachableFields.includes("messages")
			const minTokensPerPoint = config.modelInfo.minTokensPerCachePoint
			let remainingCachePoints: number = config.modelInfo.maxCachePoints

			const useSystemCache =
				supportsSystemCache && config.systemPrompt && base.meetsMinTokenThreshold(base.getSystemTokenCount())

			let systemBlocks: SystemContentBlock[] = []
			if (config.systemPrompt) {
				systemBlocks = [{ text: config.systemPrompt } as SystemContentBlock]
				if (useSystemCache) {
					systemBlocks.push(base.createCachePoint() as SystemContentBlock)
					remainingCachePoints--
				}
			}

			if (!supportsMessageCache) {
				return base.formatResult(systemBlocks, base.messagesToContentBlocks(config.messages))
			}

			const placements = determineMessageCachePoints(
				config,
				(m) => base.estimateTokenCount(m as Anthropic.Messages.MessageParam),
				minTokensPerPoint,
				remainingCachePoints,
			)
			const messages = base.messagesToContentBlocks(config.messages)
			const cacheResult = base.formatResult(systemBlocks, base.applyCachePoints(messages, placements))

			cacheResult.messageCachePointPlacements = placements

			return cacheResult
		},
	}
}

/** MultiPointStrategy instance type */
export type MultiPointStrategy = ReturnType<typeof MultiPointStrategy>
