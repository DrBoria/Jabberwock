import axios from "axios"

import { parseApiPrice } from "@shared/api/cost"
import type { ApiHandlerOptions } from "@shared/api"
import type { ModelInfo } from "@jabberwock/types"

import {
	type OpenRouterBaseModel,
	type OpenRouterModelEndpoint,
	openRouterModelSchema,
	type OpenRouterModel,
	openRouterModelEndpointSchema,
	openRouterModelEndpointsResponseSchema,
	type ParseOpenRouterModelParams,
	openRouterModelsResponseSchema,
} from "@api/providers/fetchers/shared/openrouter-schemas"
import {
	logOpenRouterParseError,
	extractModelFromRaw,
	extractRawDataFromResponse,
	logInvalidResponse,
	logEndpointsParseError,
	computeCacheWritePrice,
	computeCacheReadPrice,
	computeReasoningFields,
	applyOpenRouterModelOverrides,
} from "@api/providers/fetchers/shared/openrouter-helpers"

export {
	openRouterModelSchema,
	type OpenRouterModel,
	openRouterModelEndpointSchema,
	type OpenRouterModelEndpoint,
	type OpenRouterBaseModel,
}

async function fetchOpenRouterModels(baseURL: string): Promise<{
	response: { data: unknown; headers?: Record<string, string | string[] | undefined>; status?: number }
	result: ReturnType<typeof openRouterModelsResponseSchema.safeParse>
}> {
	const response = await axios.get<unknown>(`${baseURL}/models`, {
		headers: {
			Accept: "application/json",
			"User-Agent": "Jabberwock/1.0",
		},
		proxy: false,
	})
	const result = openRouterModelsResponseSchema.safeParse(response.data)
	return {
		response: {
			data: response.data,
			headers: response.headers as Record<string, string | string[] | undefined>,
			status: response.status,
		},
		result,
	}
}

export async function getOpenRouterModels(options?: ApiHandlerOptions): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = options?.openRouterBaseUrl || "https://openrouter.ai/api/v1"

	try {
		const { response, result } = await fetchOpenRouterModels(baseURL)

		if (!result.success) {
			logOpenRouterParseError(response, result)
		}

		const rawData = extractRawDataFromResponse(response, result)

		if (!Array.isArray(rawData)) {
			logInvalidResponse(rawData, result)
			return models
		}

		for (const model of rawData) {
			const extracted = extractModelFromRaw(model)
			if (!extracted || !extracted.baseModel) continue
			models[extracted.id] = parseOpenRouterModel({
				id: extracted.id,
				model: extracted.baseModel,
				inputModality: extracted.inputModality,
				outputModality: extracted.outputModality,
				maxTokens: extracted.maxTokens,
				supportedParameters: extracted.supportedParameters,
			})
		}
	} catch (error) {
		console.error(
			`[jabberwock] Error fetching OpenRouter models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}

async function fetchModelEndpoints(
	baseURL: string,
	modelId: string,
): Promise<
	| {
			success: boolean
			data: {
				id: string
				architecture: { input_modalities?: string[]; output_modalities?: string[] } | undefined
				endpoints: Array<OpenRouterModelEndpoint>
			}
	  }
	| { success: false }
> {
	const response = await axios.get<unknown>(`${baseURL}/models/${modelId}/endpoints`, {
		headers: {
			Accept: "application/json",
			"User-Agent": "Jabberwock/1.0",
		},
		proxy: false,
	})
	const result = openRouterModelEndpointsResponseSchema.safeParse(response.data)

	if (!result.success) {
		logEndpointsParseError(
			response as { data: unknown; headers?: Record<string, string | string[] | undefined>; status?: number },
			result,
		)
		return { success: false }
	}

	const data = result.data.data
	return {
		success: true,
		data: {
			id: data.id,
			architecture: data.architecture
				? {
						input_modalities: data.architecture.input_modalities ?? undefined,
						output_modalities: data.architecture.output_modalities ?? undefined,
					}
				: undefined,
			endpoints: data.endpoints,
		},
	}
}

export async function getOpenRouterModelEndpoints(
	modelId: string,
	options?: ApiHandlerOptions,
): Promise<Record<string, ModelInfo>> {
	const baseURL = options?.openRouterBaseUrl || "https://openrouter.ai/api/v1"

	try {
		const endpointResult = await fetchModelEndpoints(baseURL, modelId)

		if (!endpointResult.success) return {}

		const { id, architecture, endpoints } = endpointResult.data

		if (architecture?.output_modalities?.includes("image")) {
			return {}
		}

		return buildEndpointModels(endpoints, id, architecture)
	} catch (error) {
		console.error(
			`[jabberwock] Error fetching OpenRouter model endpoints: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
		return {}
	}
}

function buildEndpointModels(
	endpoints: Array<OpenRouterModelEndpoint>,
	id: string,
	architecture: { input_modalities?: string[]; output_modalities?: string[] } | undefined,
): Record<string, ModelInfo> {
	const models: Record<string, ModelInfo> = {}
	for (const endpoint of endpoints) {
		models[endpoint.tag ?? endpoint.provider_name] = parseOpenRouterModel({
			id,
			model: endpoint,
			inputModality: architecture?.input_modalities,
			outputModality: architecture?.output_modalities,
			maxTokens: endpoint.max_completion_tokens ?? undefined,
		})
	}
	return models
}

export const parseOpenRouterModel = ({
	id,
	model,
	inputModality,
	maxTokens,
	supportedParameters,
}: ParseOpenRouterModelParams): ModelInfo => {
	const cacheWritesPrice = computeCacheWritePrice(model.pricing)
	const cacheReadsPrice = computeCacheReadPrice(model.pricing)

	const modelInfo: ModelInfo = {
		maxTokens: maxTokens || Math.ceil(model.context_length * 0.2),
		contextWindow: model.context_length,
		supportsImages: inputModality?.includes("image") ?? false,
		supportsPromptCache: typeof cacheReadsPrice !== "undefined",
		inputPrice: parseApiPrice(model.pricing?.prompt ?? undefined),
		outputPrice: parseApiPrice(model.pricing?.completion ?? undefined),
		cacheWritesPrice,
		cacheReadsPrice,
		description: model.description,
		...computeReasoningFields(supportedParameters),
	}

	applyOpenRouterModelOverrides(id, modelInfo)

	return modelInfo
}
