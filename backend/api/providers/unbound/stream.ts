import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"
import { calculateApiCostOpenAI } from "@shared/api/cost"
import { ApiStreamUsageChunk } from "@api/transform/stream"

import { UnboundUsage } from "./types"

export function processUsageMetrics(usage: OpenAI.CompletionUsage, modelInfo?: ModelInfo): ApiStreamUsageChunk {
	const unboundUsage = usage as UnboundUsage
	const inputTokens = unboundUsage?.prompt_tokens || 0
	const outputTokens = unboundUsage?.completion_tokens || 0
	const cacheWriteTokens = unboundUsage?.cache_creation_input_tokens || 0
	const cacheReadTokens = unboundUsage?.cache_read_input_tokens || 0
	const { totalCost } = modelInfo
		? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
		: { totalCost: 0 }

	return {
		type: "usage",
		inputTokens: inputTokens,
		outputTokens: outputTokens,
		cacheWriteTokens: cacheWriteTokens,
		cacheReadTokens: cacheReadTokens,
		totalCost: totalCost,
	}
}
