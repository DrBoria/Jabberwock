import axios from "axios"

import type { ModelInfo } from "@jabberwock/types"

import { parseApiPrice } from "@shared/api/cost"
import { toRequestyServiceUrl } from "@shared/utils/requesty"

const hasReasoningBudget = (id: string) =>
	id.includes("claude") || id.includes("coding/gemini-2.5") || id.includes("vertex/gemini-2.5")

const hasReasoningEffort = (id: string) => id.includes("openai") || id.includes("google/gemini-2.5")

function rawToModelInfo(rawModel: Record<string, unknown>): ModelInfo {
	return {
		maxTokens: rawModel.max_output_tokens as number | undefined,
		contextWindow: (rawModel.context_window as number | undefined) ?? 0,
		supportsPromptCache: (rawModel.supports_caching as boolean | undefined) ?? false,
		supportsImages: rawModel.supports_vision as boolean | undefined,
		supportsReasoningBudget:
			(rawModel.supports_reasoning as boolean | undefined) && hasReasoningBudget(rawModel.id as string),
		supportsReasoningEffort:
			(rawModel.supports_reasoning as boolean | undefined) && hasReasoningEffort(rawModel.id as string),
		inputPrice: parseApiPrice(rawModel.input_price as string | undefined),
		outputPrice: parseApiPrice(rawModel.output_price as string | undefined),
		description: rawModel.description as string | undefined,
		cacheWritesPrice: parseApiPrice(rawModel.caching_price as string | undefined),
		cacheReadsPrice: parseApiPrice(rawModel.cached_price as string | undefined),
	}
}

export async function getRequestyModels(baseUrl?: string, apiKey?: string): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	try {
		const headers: Record<string, string> = {}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const resolvedBaseUrl = toRequestyServiceUrl(baseUrl)
		const modelsUrl = new URL("v1/models", resolvedBaseUrl)

		const response = await axios.get(modelsUrl.toString(), { headers })
		const rawModels = response.data?.data

		if (!Array.isArray(rawModels)) {
			console.error(
				`[jabberwock] [getRequestyModels] Unexpected response format: rawModels is not iterable`,
				typeof rawModels,
				rawModels,
			)
			return models
		}

		for (const rawModel of rawModels as Array<Record<string, unknown>>) {
			models[rawModel.id as string] = rawToModelInfo(rawModel)
		}
	} catch (error) {
		console.error(
			`[jabberwock] Error fetching Requesty models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}
