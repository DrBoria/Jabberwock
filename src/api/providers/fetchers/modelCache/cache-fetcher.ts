import type { ModelRecord } from "@jabberwock/types"

import type { GetModelsOptions } from "@shared/api"

import { getOpenRouterModels } from "@api/providers/fetchers/providers/openai-compatible/openrouter"
import { getVercelAiGatewayModels } from "@api/providers/fetchers/providers/openai-compatible/vercel-ai-gateway"
import { getRequestyModels } from "@api/providers/fetchers/providers/openai-compatible/requesty"
import { getUnboundModels } from "@api/providers/fetchers/providers/openai-compatible/unbound"
import { getLiteLLMModels } from "@api/providers/fetchers/providers/openai-compatible/litellm"
import { getOllamaModels } from "@api/providers/fetchers/providers/ollama"
import { getLMStudioModels } from "@api/providers/fetchers/providers/lmstudio"

export async function fetchModelsFromProvider(options: GetModelsOptions): Promise<ModelRecord> {
	const { provider } = options

	let models: ModelRecord

	switch (provider) {
		case "openrouter":
			models = await getOpenRouterModels()
			break
		case "requesty":
			models = await getRequestyModels(options.baseUrl, options.apiKey)
			break
		case "unbound":
			models = await getUnboundModels(options.apiKey)
			break
		case "litellm":
			models = await getLiteLLMModels(options.apiKey, options.baseUrl)
			break
		case "ollama":
			models = await getOllamaModels(options.baseUrl, options.apiKey)
			break
		case "lmstudio":
			models = await getLMStudioModels(options.baseUrl)
			break
		case "vercel-ai-gateway":
			models = await getVercelAiGatewayModels()
			break
		case "jabberwock": {
			return {}
		}
		default: {
			const exhaustiveCheck: never = provider
			throw new Error(`Unknown provider: ${exhaustiveCheck}`)
		}
	}

	return models
}
