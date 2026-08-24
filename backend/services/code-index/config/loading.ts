import { ApiHandlerOptions } from "@shared/api"
import type { VscodeContextAccess } from "@features/foundation/vscode/context"
import { EmbedderProvider } from "@services/code-index/interfaces/manager"
import { PreviousConfigSnapshot } from "@services/code-index/interfaces/config"
import {
	readGlobalConfig,
	readSecret,
	resolveProvider,
	validateModelDimension,
	strOrEmpty,
	strOrUndefined,
	conditionValue,
	shouldForceRestart,
	shouldForceStop,
	shouldSkipRestart,
	hasProviderChanged,
} from "./utils"
import { ConfigManagerFields, hasAuthConfigChanged, hasDimensionChanged } from "./snapshot"

/**
 * Configuration fields populated by loading from the context proxy.
 */
export interface LoadedConfig {
	codebaseIndexEnabled: boolean
	embedderProvider: EmbedderProvider
	modelId?: string
	modelDimension?: number
	openAiOptions?: ApiHandlerOptions
	ollamaOptions?: ApiHandlerOptions
	openAiCompatibleOptions?: { baseUrl: string; apiKey: string } | undefined
	geminiOptions?: { apiKey: string } | undefined
	mistralOptions?: { apiKey: string } | undefined
	vercelAiGatewayOptions?: { apiKey: string } | undefined
	bedrockOptions?: { region: string; profile?: string } | undefined
	openRouterOptions?: { apiKey: string; specificProvider?: string } | undefined
	qdrantUrl?: string
	qdrantApiKey?: string
	searchMinScore?: number
	searchMaxResults?: number
}

export interface LoadConfigurationResult {
	configSnapshot: PreviousConfigSnapshot
	currentConfig: {
		isConfigured: boolean
		embedderProvider: EmbedderProvider
		modelId?: string
		modelDimension?: number
		openAiOptions?: ApiHandlerOptions
		ollamaOptions?: ApiHandlerOptions
		openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
		geminiOptions?: { apiKey: string }
		mistralOptions?: { apiKey: string }
		vercelAiGatewayOptions?: { apiKey: string }
		bedrockOptions?: { region: string; profile?: string }
		openRouterOptions?: { apiKey: string }
		qdrantUrl?: string
		qdrantApiKey?: string
		searchMinScore?: number
	}
	requiresRestart: boolean
}

/**
 * Loads configuration from the context proxy and returns the parsed values.
 */
export function loadConfigFromContext(contextProxy: VscodeContextAccess): LoadedConfig | undefined {
	const config = readGlobalConfig(contextProxy)
	if (!config) return undefined

	const openAiKey = readSecret(contextProxy, "codeIndexOpenAiKey")
	const qdrantApiKey = readSecret(contextProxy, "codeIndexQdrantApiKey")
	const openAiCompatibleApiKey = readSecret(contextProxy, "codebaseIndexOpenAiCompatibleApiKey")
	const geminiApiKey = readSecret(contextProxy, "codebaseIndexGeminiApiKey")
	const mistralApiKey = readSecret(contextProxy, "codebaseIndexMistralApiKey")
	const vercelAiGatewayApiKey = readSecret(contextProxy, "codebaseIndexVercelAiGatewayApiKey")
	const openRouterApiKey = readSecret(contextProxy, "codebaseIndexOpenRouterApiKey")

	const openAiCompatibleOptions =
		config.codebaseIndexOpenAiCompatibleBaseUrl && openAiCompatibleApiKey
			? {
					baseUrl: config.codebaseIndexOpenAiCompatibleBaseUrl as string,
					apiKey: openAiCompatibleApiKey,
				}
			: undefined

	const openRouterOptions = openRouterApiKey
		? {
				apiKey: openRouterApiKey,
				specificProvider: strOrUndefined(config.codebaseIndexOpenRouterSpecificProvider as string | undefined),
			}
		: undefined

	return {
		codebaseIndexEnabled: Boolean(config.codebaseIndexEnabled),
		qdrantUrl: config.codebaseIndexQdrantUrl as string | undefined,
		qdrantApiKey: strOrEmpty(qdrantApiKey),
		searchMinScore: config.codebaseIndexSearchMinScore as number | undefined,
		searchMaxResults: config.codebaseIndexSearchMaxResults as number | undefined,
		modelDimension: validateModelDimension(config.codebaseIndexEmbedderModelDimension),
		embedderProvider: resolveProvider(config.codebaseIndexEmbedderProvider as string),
		modelId: strOrUndefined(config.codebaseIndexEmbedderModelId as string | undefined),
		openAiOptions: conditionValue(openAiKey, { openAiNativeApiKey: openAiKey }),
		ollamaOptions: conditionValue(config.codebaseIndexEmbedderBaseUrl, {
			ollamaBaseUrl: config.codebaseIndexEmbedderBaseUrl as string | undefined,
		}),
		openAiCompatibleOptions,
		geminiOptions: geminiApiKey ? { apiKey: geminiApiKey } : undefined,
		mistralOptions: mistralApiKey ? { apiKey: mistralApiKey } : undefined,
		vercelAiGatewayOptions: vercelAiGatewayApiKey ? { apiKey: vercelAiGatewayApiKey } : undefined,
		openRouterOptions,
		bedrockOptions: conditionValue(config.codebaseIndexBedrockRegion, {
			region: config.codebaseIndexBedrockRegion as string,
			profile: strOrUndefined(config.codebaseIndexBedrockProfile as string | undefined),
		}),
	}
}

/**
 * Determines if the configuration change requires restart.
 */
export function computeRestartRequired(
	prev: PreviousConfigSnapshot | undefined,
	instance: ConfigManagerFields,
	isConfiguredValue: boolean,
): boolean {
	if (shouldForceRestart(prev, instance.codebaseIndexEnabled, isConfiguredValue)) {
		return true
	}
	if (shouldForceStop(prev, instance.codebaseIndexEnabled)) {
		return true
	}
	if (shouldSkipRestart(prev, instance.codebaseIndexEnabled, isConfiguredValue)) {
		return false
	}
	if (!instance.codebaseIndexEnabled) {
		return false
	}
	if (hasProviderChanged(prev, instance.embedderProvider)) {
		return true
	}
	if (hasAuthConfigChanged(prev, instance)) {
		return true
	}
	if (hasDimensionChanged(prev, instance.embedderProvider, instance.modelId)) {
		return true
	}
	return false
}
