import type { ProviderName, ProviderSettings, ModelInfo, RouterModels, ModelRecord } from "@jabberwock/types"
import {
	anthropicModels,
	deepSeekModels,
	moonshotModels,
	minimaxModels,
	geminiModels,
	mistralModels,
	openAiNativeModels,
	xaiModels,
	sambaNovaModels,
	fireworksModels,
	basetenModels,
	qwenCodeModels,
	openAiCodexModels,
} from "@jabberwock/types"
import {
	getBedrockModel,
	getLiteLLMModel,
	getLmStudioModel,
	getOllamaModel,
	getOpenAIModel,
	getOpenRouterModel,
	getRouterModel,
	getStaticModel,
	getVercelAiGatewayModel,
	getVertexModel,
	getVscodeLmModel,
	getZaiModel,
	mergeTierInfo,
} from "./useSelectedModel.providers"

export const ANTHROPIC_1M_CONTEXT_MODELS = new Set([
	"claude-sonnet-4-20250514",
	"claude-sonnet-4-5",
	"claude-sonnet-4-6",
	"claude-opus-4-6",
])

const getAnthropicModel = (
	apiConfiguration: ProviderSettings,
	defaultModelId: string,
): { id: string; info: ModelInfo | undefined } => {
	const id = apiConfiguration.apiModelId ?? defaultModelId
	const baseInfo = anthropicModels[id as keyof typeof anthropicModels]
	if (!ANTHROPIC_1M_CONTEXT_MODELS.has(id) || !apiConfiguration.anthropicBeta1MContext || !baseInfo)
		return { id, info: baseInfo }
	const tier = (
		baseInfo as typeof baseInfo & {
			tiers?: Array<{
				contextWindow: number
				inputPrice?: number
				outputPrice?: number
				cacheWritesPrice?: number
				cacheReadsPrice?: number
			}>
		}
	).tiers?.[0]
	return tier ? { id, info: mergeTierInfo(baseInfo, tier) } : { id, info: baseInfo }
}

export interface SelectorParams {
	provider: ProviderName
	apiConfiguration: ProviderSettings
	routerModels: RouterModels
	openRouterModelProviders: Record<string, Partial<ModelInfo>>
	lmStudioModels: ModelRecord | undefined
	ollamaModels: ModelRecord | undefined
	defaultModelId: string
}

export const modelSelectors: Record<string, (p: SelectorParams) => { id: string; info: ModelInfo | undefined }> = {
	openrouter: (p) =>
		getOpenRouterModel(p.apiConfiguration, p.routerModels, p.openRouterModelProviders, p.defaultModelId),
	requesty: (p) => getRouterModel(p.apiConfiguration.requestyModelId, p.routerModels.requesty, p.defaultModelId),
	unbound: (p) => getRouterModel(p.apiConfiguration.unboundModelId, p.routerModels.unbound, p.defaultModelId),
	litellm: (p) => getLiteLLMModel(p.apiConfiguration.litellmModelId, p.routerModels.litellm, p.defaultModelId),
	xai: (p) => getStaticModel(p.apiConfiguration.apiModelId, xaiModels, p.defaultModelId),
	baseten: (p) => getStaticModel(p.apiConfiguration.apiModelId, basetenModels, p.defaultModelId),
	bedrock: (p) => getBedrockModel(p.apiConfiguration, p.defaultModelId),
	vertex: (p) => getVertexModel(p.apiConfiguration, p.defaultModelId),
	gemini: (p) => getStaticModel(p.apiConfiguration.apiModelId, geminiModels, p.defaultModelId),
	deepseek: (p) => getStaticModel(p.apiConfiguration.apiModelId, deepSeekModels, p.defaultModelId),
	moonshot: (p) => getStaticModel(p.apiConfiguration.apiModelId, moonshotModels, p.defaultModelId),
	minimax: (p) => getStaticModel(p.apiConfiguration.apiModelId, minimaxModels, p.defaultModelId),
	zai: (p) => getZaiModel(p.apiConfiguration, p.defaultModelId),
	"openai-native": (p) => getStaticModel(p.apiConfiguration.apiModelId, openAiNativeModels, p.defaultModelId),
	mistral: (p) => getStaticModel(p.apiConfiguration.apiModelId, mistralModels, p.defaultModelId),
	openai: (p) => getOpenAIModel(p.apiConfiguration),
	ollama: (p) => getOllamaModel(p.apiConfiguration, p.ollamaModels),
	lmstudio: (p) => getLmStudioModel(p.apiConfiguration, p.lmStudioModels),
	"vscode-lm": (p) => getVscodeLmModel(p.apiConfiguration),
	sambanova: (p) => getStaticModel(p.apiConfiguration.apiModelId, sambaNovaModels, p.defaultModelId),
	fireworks: (p) => getStaticModel(p.apiConfiguration.apiModelId, fireworksModels, p.defaultModelId),
	jabberwock: (p) => getRouterModel(p.apiConfiguration.apiModelId, p.routerModels.jabberwock, p.defaultModelId),
	"qwen-code": (p) => getStaticModel(p.apiConfiguration.apiModelId, qwenCodeModels, p.defaultModelId),
	"openai-codex": (p) => getStaticModel(p.apiConfiguration.apiModelId, openAiCodexModels, p.defaultModelId),
	"vercel-ai-gateway": (p) => getVercelAiGatewayModel(p.apiConfiguration, p.routerModels, p.defaultModelId),
}

export const getSelectedModel = (params: SelectorParams): { id: string; info: ModelInfo | undefined } => {
	const selector = modelSelectors[params.provider]
	return selector ? selector(params) : getAnthropicModel(params.apiConfiguration, params.defaultModelId)
}
