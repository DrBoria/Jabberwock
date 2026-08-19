import type { ApiStreamUsageChunk } from "@api/transform/stream"
import type { OpenAiCodexModel } from "./types"
import { getExtractedUsageToken, getNumberProp } from "./utils"

export function normalizeUsage(
	usage: Record<string, unknown>,
	_model: OpenAiCodexModel,
): ApiStreamUsageChunk | undefined {
	if (!usage) return undefined

	const inputDetails = (usage.input_tokens_details ?? usage.prompt_tokens_details) as
		| Record<string, unknown>
		| undefined

	const cachedFromDetails = getNumberProp(inputDetails, "cached_tokens")
	const missFromDetails = getNumberProp(inputDetails, "cache_miss_tokens")

	let totalInputTokens = getExtractedUsageToken(usage, "input_tokens", "prompt_tokens")
	const hasDetailsToken = cachedFromDetails > 0 || missFromDetails > 0
	if (totalInputTokens === 0 && inputDetails && hasDetailsToken) {
		totalInputTokens = cachedFromDetails + missFromDetails
	}

	const totalOutputTokens = getExtractedUsageToken(usage, "output_tokens", "completion_tokens")
	const cacheWriteTokens = getExtractedUsageToken(usage, "cache_creation_input_tokens", "cache_write_tokens")
	const rawCacheRead = getExtractedUsageToken(usage, "cache_read_input_tokens", "cache_read_tokens", "cached_tokens")
	const cacheReadTokens = rawCacheRead || cachedFromDetails

	const outputTokensDetails = usage.output_tokens_details as Record<string, unknown> | undefined
	const reasoningTokens = getNumberProp(outputTokensDetails, "reasoning_tokens")

	return {
		type: "usage",
		inputTokens: totalInputTokens,
		outputTokens: totalOutputTokens,
		cacheWriteTokens,
		cacheReadTokens,
		...(reasoningTokens > 0 ? { reasoningTokens } : {}),
		totalCost: 0,
	}
}
