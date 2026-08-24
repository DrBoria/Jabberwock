import { EmbedderProvider } from "@services/code-index/interfaces/manager"
import { PreviousConfigSnapshot } from "@services/code-index/interfaces/config"
import { getPrevStr, optStr, hasFieldChanged } from "./utils"
import { getDefaultModelId, getModelDimension } from "@shared/api/embeddingModels"

/**
 * Interface exposing the fields needed by snapshot/checker functions.
 * The CodeIndexConfigManager class satisfies this contract.
 */
export interface ConfigManagerFields {
	openAiOptions?: { openAiNativeApiKey?: string }
	ollamaOptions?: { ollamaBaseUrl?: string }
	openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
	geminiOptions?: { apiKey: string }
	mistralOptions?: { apiKey: string }
	vercelAiGatewayOptions?: { apiKey: string }
	bedrockOptions?: { region: string; profile?: string }
	openRouterOptions?: { apiKey: string; specificProvider?: string }
	qdrantUrl?: string
	qdrantApiKey?: string
	codebaseIndexEnabled: boolean
	embedderProvider: EmbedderProvider
	modelId?: string
	modelDimension?: number
	searchMinScore?: number
	searchMaxResults?: number
}

export function hasAuthConfigChanged(prev: PreviousConfigSnapshot | undefined, mgr: ConfigManagerFields): boolean {
	const pairs: [string | undefined, string | undefined][] = [
		[getPrevStr(prev, "openAiKey"), optStr(mgr.openAiOptions, "openAiNativeApiKey")],
		[getPrevStr(prev, "ollamaBaseUrl"), optStr(mgr.ollamaOptions, "ollamaBaseUrl")],
		[getPrevStr(prev, "openAiCompatibleBaseUrl"), optStr(mgr.openAiCompatibleOptions, "baseUrl")],
		[getPrevStr(prev, "openAiCompatibleApiKey"), optStr(mgr.openAiCompatibleOptions, "apiKey")],
		[getPrevStr(prev, "geminiApiKey"), optStr(mgr.geminiOptions, "apiKey")],
		[getPrevStr(prev, "mistralApiKey"), optStr(mgr.mistralOptions, "apiKey")],
		[getPrevStr(prev, "vercelAiGatewayApiKey"), optStr(mgr.vercelAiGatewayOptions, "apiKey")],
		[getPrevStr(prev, "bedrockRegion"), optStr(mgr.bedrockOptions, "region")],
		[getPrevStr(prev, "bedrockProfile"), optStr(mgr.bedrockOptions, "profile")],
		[getPrevStr(prev, "openRouterApiKey"), optStr(mgr.openRouterOptions, "apiKey")],
		[getPrevStr(prev, "openRouterSpecificProvider"), optStr(mgr.openRouterOptions, "specificProvider")],
		[getPrevStr(prev, "modelDimension"), String(mgr.modelDimension ?? "")],
		[getPrevStr(prev, "qdrantUrl"), mgr.qdrantUrl],
		[getPrevStr(prev, "qdrantApiKey"), mgr.qdrantApiKey],
	]
	return hasFieldChanged(pairs)
}

export function hasDimensionChanged(
	prev: PreviousConfigSnapshot | undefined,
	currentProvider: EmbedderProvider,
	currentModelId?: string,
): boolean {
	const prevProvider = getPrevStr(prev, "embedderProvider") as EmbedderProvider | undefined
	const prevModelId = getPrevStr(prev, "modelId")
	const resolvedPrevProvider = prevProvider ?? "openai"
	const resolvedPrevModelId = prevModelId ?? getDefaultModelId(resolvedPrevProvider)
	const resolvedCurrentModelId = currentModelId ?? getDefaultModelId(currentProvider)
	if (prevProvider === currentProvider && resolvedPrevModelId === resolvedCurrentModelId) {
		return false
	}
	const prevDimension = getModelDimension(resolvedPrevProvider, resolvedPrevModelId)
	const currentDimension = getModelDimension(currentProvider, resolvedCurrentModelId)
	if (prevDimension === undefined || currentDimension === undefined) {
		return true
	}
	return prevDimension !== currentDimension
}

export const CONFIG_CHECKERS: Record<EmbedderProvider, (mgr: ConfigManagerFields) => boolean> = {
	openai: (m) => !!(m.openAiOptions?.openAiNativeApiKey && m.qdrantUrl),
	ollama: (m) => !!(m.ollamaOptions?.ollamaBaseUrl && m.qdrantUrl),
	"openai-compatible": (m) =>
		!!(m.openAiCompatibleOptions?.baseUrl && m.openAiCompatibleOptions?.apiKey && m.qdrantUrl),
	gemini: (m) => !!(m.geminiOptions?.apiKey && m.qdrantUrl),
	mistral: (m) => !!(m.mistralOptions?.apiKey && m.qdrantUrl),
	"vercel-ai-gateway": (m) => !!(m.vercelAiGatewayOptions?.apiKey && m.qdrantUrl),
	bedrock: (m) => !!(m.bedrockOptions?.region && m.qdrantUrl),
	openrouter: (m) => !!(m.openRouterOptions?.apiKey && m.qdrantUrl),
}

export function buildSnapshot(mgr: ConfigManagerFields): PreviousConfigSnapshot {
	return {
		enabled: mgr.codebaseIndexEnabled,
		configured: isConfiguredSnapshot(mgr),
		embedderProvider: mgr.embedderProvider,
		modelId: mgr.modelId,
		modelDimension: mgr.modelDimension,
		openAiKey: optStr(mgr.openAiOptions, "openAiNativeApiKey"),
		ollamaBaseUrl: optStr(mgr.ollamaOptions, "ollamaBaseUrl"),
		openAiCompatibleBaseUrl: optStr(mgr.openAiCompatibleOptions, "baseUrl"),
		openAiCompatibleApiKey: optStr(mgr.openAiCompatibleOptions, "apiKey"),
		geminiApiKey: optStr(mgr.geminiOptions, "apiKey"),
		mistralApiKey: optStr(mgr.mistralOptions, "apiKey"),
		vercelAiGatewayApiKey: optStr(mgr.vercelAiGatewayOptions, "apiKey"),
		bedrockRegion: optStr(mgr.bedrockOptions, "region"),
		bedrockProfile: optStr(mgr.bedrockOptions, "profile"),
		openRouterApiKey: optStr(mgr.openRouterOptions, "apiKey"),
		openRouterSpecificProvider: optStr(mgr.openRouterOptions, "specificProvider"),
		qdrantUrl: mgr.qdrantUrl,
		qdrantApiKey: mgr.qdrantApiKey,
	}
}

function isConfiguredSnapshot(mgr: ConfigManagerFields): boolean {
	const checker = CONFIG_CHECKERS[mgr.embedderProvider]
	return checker ? checker(mgr) : false
}
