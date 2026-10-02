import OpenAI from "openai"

import { type ModelInfo, type ModelRecord } from "@jabberwock/types"

import { ApiHandlerOptions, RouterName } from "@shared/api"

import { createBaseProvider } from "./base-provider"
import { getModels, getModelsFromCache } from "./fetchers/modelCache"

import { DEFAULT_HEADERS } from "./constants"

type RouterProviderOptions = {
	name: RouterName
	baseURL: string
	apiKey?: string
	modelId?: string
	defaultModelId: string
	defaultModelInfo: ModelInfo
	options: ApiHandlerOptions
}

export function RouterProvider({
	options,
	name,
	baseURL,
	apiKey = "not-provided",
	modelId,
	defaultModelId,
	defaultModelInfo,
}: RouterProviderOptions) {
	let models: ModelRecord = {}
	const client = new OpenAI({
		baseURL,
		apiKey,
		defaultHeaders: {
			...DEFAULT_HEADERS,
			...(options.openAiHeaders || {}),
		},
	})

	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		name,
		models,
		modelId,
		defaultModelId,
		defaultModelInfo,
		client,
		async fetchModel() {
			handler.models = await getModels({
				provider: handler.name,
				apiKey: handler.client.apiKey,
				baseUrl: handler.client.baseURL,
			})
			return handler.getModel()
		},
		getModel(): {
			id: string
			info: ModelInfo
		} {
			const id = handler.modelId ?? handler.defaultModelId
			// First check instance models (populated by fetchModel)
			if (handler.models[id]) {
				return { id, info: handler.models[id] }
			}
			// Fall back to global cache (synchronous disk/memory cache)
			// This ensures models are available before fetchModel() is called
			const cachedModels = getModelsFromCache(handler.name)
			if (cachedModels?.[id]) {
				// Also populate instance models for future calls
				handler.models = cachedModels
				return { id, info: cachedModels[id] }
			}
			// Last resort: return default model
			return { id: handler.defaultModelId, info: handler.defaultModelInfo }
		},
		supportsTemperature(modelId: string): boolean {
			return !modelId.startsWith("openai/o3-mini")
		},
	}
	return handler
}
