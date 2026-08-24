import {
	bedrockModels,
	openAiModelInfoSaneDefaults,
	vertexModels,
	vscodeLlmModels,
	vscodeLlmDefaultModelId,
	litellmDefaultModelInfo,
	lMStudioDefaultModelInfo,
	BEDROCK_1M_CONTEXT_MODEL_IDS,
	VERTEX_1M_CONTEXT_MODEL_IDS,
	getProviderDefaultModelId,
	internationalZAiModels,
	mainlandZAiModels,
} from "@jabberwock/types"

export const getValidatedModelId = (
	configuredId: string | undefined,
	availableModels: ModelRecord | undefined,
	defaultModelId: string,
): string => (configuredId && availableModels?.[configuredId] ? configuredId : defaultModelId)
import type { ModelRecord, ModelInfo, ProviderSettings, RouterModels } from "@jabberwock/types"

export const getStaticModel = (
	modelId: string | undefined,
	models: Record<string, ModelInfo>,
	defaultModelId: string,
): { id: string; info: ModelInfo | undefined } => {
	const id = modelId ?? defaultModelId
	const info = models[id as keyof typeof models]
	return info ? { id, info } : { id, info: undefined }
}

export const getRouterModel = (
	modelId: string | undefined,
	models: ModelRecord | undefined,
	defaultModelId: string,
): { id: string; info: ModelInfo | undefined } => {
	const id = getValidatedModelId(modelId, models, defaultModelId)
	return { id, info: models?.[id] }
}

export const getOpenRouterModel = (
	apiConfiguration: ProviderSettings,
	routerModels: RouterModels,
	openRouterModelProviders: Record<string, Partial<ModelInfo>>,
	defaultModelId: string,
): { id: string; info: ModelInfo | undefined } => {
	const id = getValidatedModelId(apiConfiguration.openRouterModelId, routerModels.openrouter, defaultModelId)
	let info = routerModels.openrouter?.[id]
	const specificProvider = apiConfiguration.openRouterSpecificProvider
	if (specificProvider && openRouterModelProviders[specificProvider]) {
		const providerInfo = openRouterModelProviders[specificProvider]
		info = info ? { ...info, ...providerInfo } : ({ ...providerInfo } as ModelInfo)
	}
	return { id, info }
}

export const getLiteLLMModel = (
	modelId: string | undefined,
	models: ModelRecord | undefined,
	defaultModelId: string,
): { id: string; info: ModelInfo | undefined } => {
	const id = getValidatedModelId(modelId, models, defaultModelId)
	return { id, info: models?.[id] ?? litellmDefaultModelInfo }
}

export const getBedrockModel = (
	apiConfiguration: ProviderSettings,
	defaultModelId: string,
): { id: string; info: ModelInfo | undefined } => {
	const id = apiConfiguration.apiModelId ?? defaultModelId
	const baseInfo = bedrockModels[id as keyof typeof bedrockModels]
	if (id === "custom-arn")
		return {
			id,
			info: { maxTokens: 5000, contextWindow: 128_000, supportsPromptCache: true, supportsImages: true },
		}
	if (
		(BEDROCK_1M_CONTEXT_MODEL_IDS as readonly string[]).includes(id) &&
		apiConfiguration.awsBedrock1MContext &&
		baseInfo
	)
		return { id, info: { ...baseInfo, contextWindow: 1_000_000 } }
	return { id, info: baseInfo }
}

export const mergeTierInfo = (
	baseInfo: ModelInfo,
	tier: {
		contextWindow: number
		inputPrice?: number
		outputPrice?: number
		cacheWritesPrice?: number
		cacheReadsPrice?: number
	},
): ModelInfo => ({
	...baseInfo,
	contextWindow: tier.contextWindow,
	inputPrice: tier.inputPrice ?? baseInfo.inputPrice,
	outputPrice: tier.outputPrice ?? baseInfo.outputPrice,
	cacheWritesPrice: tier.cacheWritesPrice ?? baseInfo.cacheWritesPrice,
	cacheReadsPrice: tier.cacheReadsPrice ?? baseInfo.cacheReadsPrice,
})

export const getVertexModel = (
	apiConfiguration: ProviderSettings,
	defaultModelId: string,
): { id: string; info: ModelInfo | undefined } => {
	const id = apiConfiguration.apiModelId ?? defaultModelId
	const baseInfo = vertexModels[id as keyof typeof vertexModels]
	if (
		(VERTEX_1M_CONTEXT_MODEL_IDS as readonly string[]).includes(id) &&
		apiConfiguration.vertex1MContext &&
		baseInfo
	) {
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
		if (tier) return { id, info: mergeTierInfo(baseInfo, tier) }
	}
	return { id, info: baseInfo }
}

export const getZaiModel = (
	apiConfiguration: ProviderSettings,
	_defaultModelId: string,
): { id: string; info: ModelInfo | undefined } => {
	const isChina = apiConfiguration.zaiApiLine === "china_coding"
	const models = isChina ? mainlandZAiModels : internationalZAiModels
	const id = apiConfiguration.apiModelId ?? getProviderDefaultModelId("zai", { isChina })
	return { id, info: models[id as keyof typeof models] }
}

export const getOpenAIModel = (apiConfiguration: ProviderSettings): { id: string; info: ModelInfo | undefined } => {
	const info = apiConfiguration?.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
	return { id: apiConfiguration.openAiModelId ?? "", info }
}

export const getOllamaModel = (
	apiConfiguration: ProviderSettings,
	ollamaModels: ModelRecord | undefined,
): { id: string; info: ModelInfo | undefined } => {
	const id = apiConfiguration.ollamaModelId ?? ""
	const info = ollamaModels && ollamaModels[apiConfiguration.ollamaModelId!]
	const adjustedInfo =
		info?.contextWindow && apiConfiguration?.ollamaNumCtx && apiConfiguration.ollamaNumCtx < info.contextWindow
			? { ...info, contextWindow: apiConfiguration.ollamaNumCtx }
			: info
	return { id, info: adjustedInfo || undefined }
}

export const getLmStudioModel = (
	apiConfiguration: ProviderSettings,
	lmStudioModels: ModelRecord | undefined,
): { id: string; info: ModelInfo | undefined } => {
	const id = apiConfiguration.lmStudioModelId ?? ""
	const modelInfo = lmStudioModels && lmStudioModels[apiConfiguration.lmStudioModelId!]
	return { id, info: modelInfo ? { ...lMStudioDefaultModelInfo, ...modelInfo } : undefined }
}

export const getVscodeLmModel = (apiConfiguration: ProviderSettings): { id: string; info: ModelInfo | undefined } => {
	const id = apiConfiguration?.vsCodeLmModelSelector
		? `${apiConfiguration.vsCodeLmModelSelector.vendor}/${apiConfiguration.vsCodeLmModelSelector.family}`
		: vscodeLlmDefaultModelId
	const modelFamily = apiConfiguration?.vsCodeLmModelSelector?.family ?? vscodeLlmDefaultModelId
	return {
		id,
		info: {
			...openAiModelInfoSaneDefaults,
			...vscodeLlmModels[modelFamily as keyof typeof vscodeLlmModels],
			supportsImages: false,
		},
	}
}

export const getVercelAiGatewayModel = (
	apiConfiguration: ProviderSettings,
	routerModels: RouterModels,
	defaultModelId: string,
): { id: string; info: ModelInfo | undefined } => {
	const id = getValidatedModelId(
		apiConfiguration.vercelAiGatewayModelId,
		routerModels["vercel-ai-gateway"],
		defaultModelId,
	)
	return { id, info: routerModels["vercel-ai-gateway"]?.[id] }
}
