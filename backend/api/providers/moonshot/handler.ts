import { moonshotModels, moonshotDefaultModelId } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import type { ApiStreamUsageChunk } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"

import { OpenAICompatibleHandler, OpenAICompatibleConfig } from "@api/providers/openai/compatible"

export function MoonshotHandler(options: ApiHandlerOptions) {
	const modelId = options.apiModelId ?? moonshotDefaultModelId
	const modelInfo = moonshotModels[modelId as keyof typeof moonshotModels] || moonshotModels[moonshotDefaultModelId]

	const config: OpenAICompatibleConfig = {
		providerName: "moonshot",
		baseURL: options.moonshotBaseUrl || "https://api.moonshot.ai/v1",
		apiKey: options.moonshotApiKey ?? "not-provided",
		modelId,
		modelInfo,
		modelMaxTokens: options.modelMaxTokens ?? undefined,
		temperature: options.modelTemperature ?? undefined,
	}

	const base = OpenAICompatibleHandler(options, config)
	const handler = {
		...base,
		getModel() {
			const id = handler.options.apiModelId ?? moonshotDefaultModelId
			const info = moonshotModels[id as keyof typeof moonshotModels] || moonshotModels[moonshotDefaultModelId]
			const params = getModelParams({
				format: "openai",
				modelId: id,
				model: info,
				settings: handler.options,
				defaultTemperature: 0,
			})
			return { id, info, ...params }
		},
		processUsageMetrics(usage: {
			inputTokens?: number
			outputTokens?: number
			details?: {
				cachedInputTokens?: number
				reasoningTokens?: number
			}
			raw?: Record<string, unknown>
		}): ApiStreamUsageChunk {
			// Moonshot uses cached_tokens at the top level of raw usage data
			const rawUsage = usage.raw as
				| {
						cached_tokens?: number
				  }
				| undefined
			return {
				type: "usage",
				inputTokens: usage.inputTokens || 0,
				outputTokens: usage.outputTokens || 0,
				cacheWriteTokens: 0,
				cacheReadTokens: rawUsage?.cached_tokens ?? usage.details?.cachedInputTokens,
			}
		},
		getMaxOutputTokens(): number | undefined {
			const modelInfo = handler.config.modelInfo
			// Moonshot always requires max_tokens
			return handler.options.modelMaxTokens || modelInfo.maxTokens || undefined
		},
	}
	return handler
}
