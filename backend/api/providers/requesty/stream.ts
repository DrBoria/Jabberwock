import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"
import { calculateApiCostOpenAI } from "@shared/api/cost"
import { ApiStreamUsageChunk } from "@api/transform/stream"

import { RequestyUsage } from "./types"

export function extractRequestyCounts(usage: OpenAI.CompletionUsage): { inputTokens: number; outputTokens: number } {
	const requestyUsage = usage as RequestyUsage
	return {
		inputTokens: requestyUsage?.prompt_tokens || 0,
		outputTokens: requestyUsage?.completion_tokens || 0,
	}
}

export function extractRequestyCacheTokens(usage: OpenAI.CompletionUsage): {
	cacheWriteTokens: number
	cacheReadTokens: number
} {
	const requestyUsage = usage as RequestyUsage
	return {
		cacheWriteTokens: requestyUsage?.prompt_tokens_details?.caching_tokens || 0,
		cacheReadTokens: requestyUsage?.prompt_tokens_details?.cached_tokens || 0,
	}
}

export function processUsageMetrics(usage: OpenAI.CompletionUsage, modelInfo?: ModelInfo): ApiStreamUsageChunk {
	const { inputTokens, outputTokens } = extractRequestyCounts(usage)
	const { cacheWriteTokens, cacheReadTokens } = extractRequestyCacheTokens(usage)
	const { totalCost } = modelInfo
		? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
		: { totalCost: 0 }

	return {
		type: "usage",
		inputTokens,
		outputTokens,
		cacheWriteTokens,
		cacheReadTokens,
		totalCost,
	}
}
