import axios from "axios"

import type { ModelInfo, ModelRecord } from "@jabberwock/types"

import { DEFAULT_HEADERS } from "@api/providers/constants"

function toMicroPrice(value: unknown): number | undefined {
	if (typeof value === "number") {
		return value * 1000000
	}
	return undefined
}

/**
 * Fetches available models from a LiteLLM server
 *
 * @param apiKey The API key for the LiteLLM server
 * @param baseUrl The base URL of the LiteLLM server
 * @returns A promise that resolves to a record of model IDs to model info
 * @throws Will throw an error if the request fails or the response is not as expected.
 */
function convertLiteLLMModel(model: Record<string, unknown>): ModelInfo | null {
	const modelName = model.model_name as string | undefined
	const modelInfo = model.model_info as Record<string, unknown> | undefined
	const litellmModelName = model?.litellm_params as Record<string, unknown> | undefined

	if (!modelName || !modelInfo || !litellmModelName) return null

	return {
		maxTokens: (modelInfo.max_output_tokens as number) || (modelInfo.max_tokens as number) || 8192,
		contextWindow: (modelInfo.max_input_tokens as number) || 200000,
		supportsImages: Boolean(modelInfo.supports_vision),
		supportsPromptCache: Boolean(modelInfo.supports_prompt_caching),
		inputPrice: toMicroPrice(modelInfo.input_cost_per_token),
		outputPrice: toMicroPrice(modelInfo.output_cost_per_token),
		cacheWritesPrice: toMicroPrice(modelInfo.cache_creation_input_token_cost),
		cacheReadsPrice: toMicroPrice(modelInfo.cache_read_input_token_cost),
		description: `${modelName} via LiteLLM proxy`,
	}
}

function rethrowLiteLLMError(error: unknown): never {
	const message = error instanceof Error ? error.message : String(error)
	console.error("[jabberwock] Error fetching LiteLLM models:", message)
	if (axios.isAxiosError(error) && error.response) {
		throw new Error(
			`Failed to fetch LiteLLM models: ${error.response.status} ${error.response.statusText}. Check base URL and API key.`,
		)
	}
	if (axios.isAxiosError(error) && error.request) {
		throw new Error(
			"Failed to fetch LiteLLM models: No response from server. Check LiteLLM server status and base URL.",
		)
	}
	throw new Error(`Failed to fetch LiteLLM models: ${message}`)
}

export async function getLiteLLMModels(apiKey: string, baseUrl: string): Promise<ModelRecord> {
	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...DEFAULT_HEADERS,
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const urlObj = new URL(baseUrl)
		urlObj.pathname = urlObj.pathname.replace(/\/+$/, "").replace(/\/+/g, "/") + "/v1/model/info"
		const url = urlObj.href
		const response = await axios.get(url, { headers, timeout: 5000 })
		const models: ModelRecord = {}

		if (response.data && response.data.data && Array.isArray(response.data.data)) {
			for (const model of response.data.data as Array<Record<string, unknown>>) {
				const converted = convertLiteLLMModel(model)
				if (converted) {
					models[model.model_name as string] = converted
				}
			}
		} else {
			console.error("[jabberwock] Error fetching LiteLLM models: Unexpected response format", response.data)
			throw new Error("Failed to fetch LiteLLM models: Unexpected response format.")
		}

		return models
	} catch (error) {
		rethrowLiteLLMError(error)
	}
}
