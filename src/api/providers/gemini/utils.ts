import type { Anthropic } from "@anthropic-ai/sdk"
import type { GroundingMetadata, GenerateContentResponseUsageMetadata } from "@google/genai"

import type { ModelInfo } from "@jabberwock/types"
import type { ApiHandlerOptions } from "@shared/api"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import type { GroundingSource } from "@api/transform/stream"

export function filterReasoningMessages(
	messages: Anthropic.Messages.MessageParam[],
): Anthropic.Messages.MessageParam[] {
	type ReasoningMetaLike = { type?: string }
	return messages.filter((message): message is Anthropic.Messages.MessageParam => {
		const meta = message as ReasoningMetaLike
		if (meta.type === "reasoning") {
			return false
		}
		return true
	})
}

export function buildToolIdMap(messages: Anthropic.Messages.MessageParam[]): Map<string, string> {
	const toolIdToName = new Map<string, string>()
	for (const message of messages) {
		if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "tool_use") {
					toolIdToName.set(block.id, block.name)
				}
			}
		}
	}
	return toolIdToName
}

export function buildTemperatureConfig(info: ModelInfo, options: ApiHandlerOptions): number | undefined {
	const supportsTemperature = info.supportsTemperature !== false
	return supportsTemperature ? (options.modelTemperature ?? info.defaultTemperature ?? 1) : info.defaultTemperature
}

export function buildMaxOutputTokens(
	info: ModelInfo,
	maxTokens: number | undefined,
	modelMaxTokens: number | undefined,
): number | undefined {
	const isHybridReasoningModel = info.supportsReasoningBudget || info.requiredReasoningBudget
	return isHybridReasoningModel ? (modelMaxTokens ?? maxTokens ?? undefined) : (maxTokens ?? undefined)
}

export function shouldIncludeThoughtSignatures(
	thinkingConfig: unknown,
	metadata?: ApiHandlerCreateMessageMetadata,
): boolean {
	return Boolean(thinkingConfig) || Boolean(metadata?.tools?.length)
}

export function extractGroundingSources(groundingMetadata?: GroundingMetadata): GroundingSource[] {
	const chunks = groundingMetadata?.groundingChunks

	if (!chunks) {
		return []
	}

	return chunks
		.map((chunk): GroundingSource | null => {
			const uri = chunk.web?.uri
			const title = chunk.web?.title || uri || "Unknown Source"

			if (uri) {
				return {
					title,
					url: uri,
				}
			}
			return null
		})
		.filter((source): source is GroundingSource => source !== null)
}

export function extractCitationsOnly(groundingMetadata?: GroundingMetadata): string | null {
	const sources = extractGroundingSources(groundingMetadata)

	if (sources.length === 0) {
		return null
	}

	const citationLinks = sources.map((source, i) => `[${i + 1}](${source.url})`)
	return citationLinks.join(", ")
}

export function resolveTierPricing(
	info: ModelInfo,
	inputTokens: number,
): {
	inputPrice: number | undefined
	outputPrice: number | undefined
	cacheReadsPrice: number | undefined
} {
	let inputPrice = info.inputPrice
	let outputPrice = info.outputPrice
	let cacheReadsPrice = info.cacheReadsPrice

	if (info.tiers) {
		const tier = info.tiers.find((tier) => inputTokens <= tier.contextWindow)
		if (tier) {
			inputPrice = tier.inputPrice ?? inputPrice
			outputPrice = tier.outputPrice ?? outputPrice
			cacheReadsPrice = tier.cacheReadsPrice ?? cacheReadsPrice
		}
	}

	return { inputPrice, outputPrice, cacheReadsPrice }
}

export function computeCost(
	inputPrice: number,
	outputPrice: number,
	cacheReadsPrice: number,
	uncachedInputTokens: number,
	billedOutputTokens: number,
	cacheReadTokens: number,
): number {
	const cacheReadCost = cacheReadTokens > 0 ? cacheReadsPrice * (cacheReadTokens / 1_000_000) : 0
	const inputTokensCost = inputPrice * (uncachedInputTokens / 1_000_000)
	const outputTokensCost = outputPrice * (billedOutputTokens / 1_000_000)

	return inputTokensCost + outputTokensCost + cacheReadCost
}

export function calculateCost({
	info,
	inputTokens,
	outputTokens,
	cacheReadTokens = 0,
	reasoningTokens = 0,
}: {
	info: ModelInfo
	inputTokens: number
	outputTokens: number
	cacheReadTokens?: number
	reasoningTokens?: number
}): number | undefined {
	const { inputPrice, outputPrice, cacheReadsPrice } = resolveTierPricing(info, inputTokens)

	if (!inputPrice || !outputPrice) {
		return undefined
	}

	const effectiveCacheReadPrice = cacheReadsPrice ?? 0
	const uncachedInputTokens = inputTokens - cacheReadTokens
	const billedOutputTokens = outputTokens + reasoningTokens

	return computeCost(
		inputPrice,
		outputPrice,
		effectiveCacheReadPrice,
		uncachedInputTokens,
		billedOutputTokens,
		cacheReadTokens,
	)
}

export function buildUsageChunk(
	lastUsageMetadata: GenerateContentResponseUsageMetadata,
	info: ModelInfo,
): {
	type: "usage"
	inputTokens: number
	outputTokens: number
	cacheReadTokens?: number
	reasoningTokens?: number
	totalCost?: number
} {
	const promptTokens = lastUsageMetadata.promptTokenCount ?? 0
	const candidateTokens = lastUsageMetadata.candidatesTokenCount ?? 0
	const cachedTokens = lastUsageMetadata.cachedContentTokenCount
	const thoughtTokens = lastUsageMetadata.thoughtsTokenCount

	return {
		type: "usage",
		inputTokens: promptTokens,
		outputTokens: candidateTokens,
		cacheReadTokens: cachedTokens,
		reasoningTokens: thoughtTokens,
		totalCost: calculateCost({
			info,
			inputTokens: promptTokens,
			outputTokens: candidateTokens,
			cacheReadTokens: cachedTokens,
			reasoningTokens: thoughtTokens,
		}),
	}
}
