/**
 * Unified cache tracking utilities for API provider streaming.
 *
 * Providers report cache tokens in different formats:
 * - OpenAI SDK: cache_creation_input_tokens / cache_read_input_tokens
 * - OpenAI-compatible: prompt_tokens_details.cache_write_tokens / cached_tokens
 * - OpenRouter: prompt_tokens_details.cached_tokens + completion_tokens_details.reasoning_tokens
 *
 * This module normalises all formats into a single ApiStreamUsageChunk shape.
 */

import type { ApiStreamUsageChunk } from "@api/transform/stream"

/**
 * Raw usage data that may carry cache and reasoning metrics.
 * Matches the OpenAI `CompletionUsage` shape with optional extended fields.
 */
interface RawUsage {
	prompt_tokens?: number
	completion_tokens?: number
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
	prompt_tokens_details?: {
		cache_write_tokens?: number
		cached_tokens?: number
	}
	completion_tokens_details?: {
		reasoning_tokens?: number
	}
	cost?: number
}

/**
 * Extract cache write and read tokens from raw provider usage data.
 * Handles both the flat OpenAI SDK format and the nested OpenAI-compatible format.
 */
export function extractCacheMetrics(usage: RawUsage | undefined): {
	cacheWriteTokens: number | undefined
	cacheReadTokens: number | undefined
} {
	if (!usage) {
		return { cacheWriteTokens: undefined, cacheReadTokens: undefined }
	}

	// OpenAI SDK flat format: cache_creation_input_tokens / cache_read_input_tokens
	if (usage.cache_creation_input_tokens !== undefined || usage.cache_read_input_tokens !== undefined) {
		return {
			cacheWriteTokens: usage.cache_creation_input_tokens,
			cacheReadTokens: usage.cache_read_input_tokens,
		}
	}

	// OpenAI-compatible / OpenRouter nested format: prompt_tokens_details
	if (usage.prompt_tokens_details) {
		return {
			cacheWriteTokens: usage.prompt_tokens_details.cache_write_tokens,
			cacheReadTokens: usage.prompt_tokens_details.cached_tokens,
		}
	}

	return { cacheWriteTokens: undefined, cacheReadTokens: undefined }
}

/**
 * Build a standardised ApiStreamUsageChunk from raw provider usage data.
 *
 * @param usage - Raw usage object from the provider SDK
 * @param totalCost - Optional total cost for the request
 * @param reasoningTokens - Optional reasoning/completion tokens (OpenRouter style)
 */
export function buildUsageChunk(
	usage: RawUsage | undefined,
	totalCost?: number,
	reasoningTokens?: number,
): ApiStreamUsageChunk {
	const { cacheWriteTokens, cacheReadTokens } = extractCacheMetrics(usage)

	const inputTokens = usage?.prompt_tokens ?? 0
	const outputTokens = usage?.completion_tokens ?? 0
	const finalReasoningTokens = resolveReasoningTokens(usage, reasoningTokens)

	const result: ApiStreamUsageChunk = {
		type: "usage",
		inputTokens,
		outputTokens,
		cacheWriteTokens: cacheWriteTokens ?? undefined,
		cacheReadTokens: cacheReadTokens ?? undefined,
	}
	if (totalCost !== undefined) {
		result.totalCost = totalCost
	}
	if (finalReasoningTokens !== undefined) {
		result.reasoningTokens = finalReasoningTokens
	}
	return result
}

function resolveReasoningTokens(usage: RawUsage | undefined, reasoningTokens?: number): number | undefined {
	return reasoningTokens !== undefined ? reasoningTokens : usage?.completion_tokens_details?.reasoning_tokens
}
