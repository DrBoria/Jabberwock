import axios from "axios"

import type { ModelInfo } from "@jabberwock/types"

import { parseApiPrice } from "@shared/api/cost"

function normalizeModelEntries(rawModels: unknown): Array<Record<string, unknown>> {
	if (Array.isArray(rawModels)) {
		return rawModels
	}
	if (typeof rawModels === "object" && rawModels !== null) {
		return Object.entries(rawModels).map(([id, model]) => ({ id, ...(model as Record<string, unknown>) }))
	}
	return []
}

function rawToUnboundModelInfo(rawModel: Record<string, unknown>): ModelInfo {
	return {
		maxTokens: (rawModel.max_output_tokens as number | undefined) ?? 8192,
		contextWindow: (rawModel.context_window as number | undefined) ?? 200_000,
		supportsPromptCache: (rawModel.supports_caching as boolean | undefined) ?? false,
		supportsImages: (rawModel.supports_vision as boolean | undefined) ?? false,
		inputPrice: parseApiPrice(rawModel.input_price as string | undefined),
		outputPrice: parseApiPrice(rawModel.output_price as string | undefined),
		description: rawModel.description as string | undefined,
		cacheWritesPrice: parseApiPrice(rawModel.caching_price as string | undefined),
		cacheReadsPrice: parseApiPrice(rawModel.cached_price as string | undefined),
	}
}

export async function getUnboundModels(apiKey?: string | null): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	try {
		const headers: Record<string, string> = {}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const response = await axios.get("https://api.getunbound.ai/models", { headers })
		const rawModels = response.data?.data ?? response.data
		const modelEntries = normalizeModelEntries(rawModels)

		for (const rawModel of modelEntries) {
			models[rawModel.id as string] = rawToUnboundModelInfo(rawModel)
		}
	} catch (error) {
		console.error(
			`[jabberwock] Error fetching Unbound models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}
