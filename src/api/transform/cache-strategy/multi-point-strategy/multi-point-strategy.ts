import { SystemContentBlock } from "@aws-sdk/client-bedrock-runtime"

import { CacheStrategy } from "@api/transform/cache-strategy/base-strategy"
import { CacheResult } from "@api/transform/cache-strategy/types"
import { determineMessageCachePoints } from "./findOptimalStrategy"

/**
 * Strategy for handling multiple cache points.
 * Creates cache points after messages as soon as uncached tokens exceed minimumTokenCount.
 */
import { Anthropic } from "@anthropic-ai/sdk"

export class MultiPointStrategy extends CacheStrategy {
	public determineOptimalCachePoints(): CacheResult {
		if (!this.config.usePromptCache || this.config.messages.length === 0) {
			return this.formatWithoutCachePoints()
		}

		const supportsSystemCache = this.config.modelInfo.cachableFields.includes("system")
		const supportsMessageCache = this.config.modelInfo.cachableFields.includes("messages")
		const minTokensPerPoint = this.config.modelInfo.minTokensPerCachePoint
		let remainingCachePoints: number = this.config.modelInfo.maxCachePoints

		const useSystemCache =
			supportsSystemCache && this.config.systemPrompt && this.meetsMinTokenThreshold(this.systemTokenCount)

		let systemBlocks: SystemContentBlock[] = []
		if (this.config.systemPrompt) {
			systemBlocks = [{ text: this.config.systemPrompt } as SystemContentBlock]
			if (useSystemCache) {
				systemBlocks.push(this.createCachePoint() as SystemContentBlock)
				remainingCachePoints--
			}
		}

		if (!supportsMessageCache) {
			return this.formatResult(systemBlocks, this.messagesToContentBlocks(this.config.messages))
		}

		const placements = determineMessageCachePoints(
			this.config,
			(m) => this.estimateTokenCount(m as Anthropic.Messages.MessageParam),
			minTokensPerPoint,
			remainingCachePoints,
		)
		const messages = this.messagesToContentBlocks(this.config.messages)
		let cacheResult = this.formatResult(systemBlocks, this.applyCachePoints(messages, placements))

		cacheResult.messageCachePointPlacements = placements

		return cacheResult
	}

	private formatWithoutCachePoints(): CacheResult {
		const systemBlocks: SystemContentBlock[] = this.config.systemPrompt
			? [{ text: this.config.systemPrompt } as SystemContentBlock]
			: []

		return this.formatResult(systemBlocks, this.messagesToContentBlocks(this.config.messages))
	}
}
