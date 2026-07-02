import { calculateApiCostOpenAI } from "@shared/api/cost"
import { ApiStreamUsageChunk } from "@api/transform/stream"
import type { ModelInfo, ServiceTier } from "@jabberwock/types"
import type { RawUsage, OpenAiNativeModel } from "./types"

export function resolveUsageTokens(usage: RawUsage): { totalInputTokens: number; totalOutputTokens: number } {
	const inputDetails = usage.input_tokens_details ?? usage.prompt_tokens_details
	const totalInputTokens = resolveInputTokensFromDetails(usage, inputDetails)
	const totalOutputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0
	return { totalInputTokens, totalOutputTokens }
}

function resolveInputTokensFromDetails(usage: RawUsage, inputDetails: Record<string, unknown> | undefined): number {
	let totalInputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0
	if (totalInputTokens !== 0 || !inputDetails) return totalInputTokens
	const cachedFromDetails =
		typeof inputDetails.cached_tokens === "number" ? (inputDetails.cached_tokens as number) : 0
	const missFromDetails =
		typeof inputDetails.cache_miss_tokens === "number" ? (inputDetails.cache_miss_tokens as number) : 0
	if (cachedFromDetails > 0 || missFromDetails > 0) {
		totalInputTokens = cachedFromDetails + missFromDetails
	}
	return totalInputTokens
}

export function resolveCacheWriteTokens(usage: RawUsage): number {
	return usage.cache_creation_input_tokens ?? usage.cache_write_tokens ?? 0
}

export function resolveCacheReadTokens(usage: RawUsage): number {
	const inputDetails = usage.input_tokens_details ?? usage.prompt_tokens_details
	const cachedFromDetails =
		typeof inputDetails?.cached_tokens === "number" ? (inputDetails.cached_tokens as number) : 0
	return usage.cache_read_input_tokens ?? usage.cache_read_tokens ?? usage.cached_tokens ?? cachedFromDetails ?? 0
}

export function extractReasoningTokens(usage: RawUsage): number | undefined {
	const outputTokensDetails = usage.output_tokens_details
	if (typeof outputTokensDetails?.reasoning_tokens === "number") {
		return outputTokensDetails.reasoning_tokens as number
	}
	return undefined
}

export function normalizeUsage(
	usage: RawUsage,
	model: OpenAiNativeModel,
	effectiveTier: ServiceTier | undefined,
	effectiveInfo: ModelInfo,
): ApiStreamUsageChunk | undefined {
	if (!usage) return undefined

	const { totalInputTokens, totalOutputTokens } = resolveUsageTokens(usage)
	const cacheWriteTokens = resolveCacheWriteTokens(usage)
	const cacheReadTokens = resolveCacheReadTokens(usage)

	const { totalCost } = calculateApiCostOpenAI(
		effectiveInfo,
		totalInputTokens,
		totalOutputTokens,
		cacheWriteTokens,
		cacheReadTokens,
		effectiveTier,
	)

	const reasoningTokens = extractReasoningTokens(usage)

	return {
		type: "usage",
		inputTokens: totalInputTokens,
		outputTokens: totalOutputTokens,
		cacheWriteTokens,
		cacheReadTokens,
		...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
		totalCost,
	}
}

export function applyPricingByTier(info: ModelInfo, tier?: ServiceTier): ModelInfo {
	if (!tier || tier === "default") return info

	const tierInfo = info.tiers?.find((t) => t.name === tier)
	if (!tierInfo) return info

	return {
		...info,
		inputPrice: tierInfo.inputPrice ?? info.inputPrice,
		outputPrice: tierInfo.outputPrice ?? info.outputPrice,
		cacheReadsPrice: tierInfo.cacheReadsPrice ?? info.cacheReadsPrice,
		cacheWritesPrice: tierInfo.cacheWritesPrice ?? info.cacheWritesPrice,
	}
}
