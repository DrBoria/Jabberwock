import { ApiHandlerOptions } from "@shared/api"
import type { IHostEnvironment } from "@features/foundation/host-context/context"
import { EmbedderProvider } from "@services/code-index/interfaces/manager"
import { CodeIndexConfig, PreviousConfigSnapshot } from "@services/code-index/interfaces/config"
import { DEFAULT_SEARCH_MIN_SCORE, DEFAULT_MAX_SEARCH_RESULTS } from "@services/code-index/constants"
import { getDefaultModelId, getModelDimension, getModelScoreThreshold } from "@shared/api/embeddingModels"
import { CONFIG_CHECKERS, buildSnapshot } from "./snapshot"
import { LoadedConfig, loadConfigFromContext, LoadConfigurationResult, computeRestartRequired } from "./loading"

/**
 * Manages configuration state and validation for the code indexing feature.
 * Handles loading, validating, and providing access to configuration values.
 */
export function CodeIndexConfigManager(contextProxy: IHostEnvironment) {
	const handler = {
		get isFeatureEnabled(): boolean {
			return this.codebaseIndexEnabled
		},

		get isFeatureConfigured(): boolean {
			return this.isConfigured()
		},

		get currentEmbedderProvider(): EmbedderProvider {
			return this.embedderProvider
		},

		get qdrantConfig(): { url?: string; apiKey?: string } {
			return {
				url: this.qdrantUrl,
				apiKey: this.qdrantApiKey,
			}
		},

		get currentModelId(): string | undefined {
			return this.modelId
		},

		get currentModelDimension(): number | undefined {
			const modelId = this.modelId ?? getDefaultModelId(this.embedderProvider)
			const modelDimension = getModelDimension(this.embedderProvider, modelId)

			if (!modelDimension && this.modelDimension && this.modelDimension > 0) {
				return this.modelDimension
			}

			return modelDimension
		},

		get currentSearchMinScore(): number {
			if (this.searchMinScore !== undefined) {
				return this.searchMinScore
			}

			const currentModelId = this.modelId ?? getDefaultModelId(this.embedderProvider)
			const modelSpecificThreshold = getModelScoreThreshold(this.embedderProvider, currentModelId)
			return modelSpecificThreshold ?? DEFAULT_SEARCH_MIN_SCORE
		},

		get currentSearchMaxResults(): number {
			return this.searchMaxResults ?? DEFAULT_MAX_SEARCH_RESULTS
		},
		codebaseIndexEnabled: false as boolean,
		embedderProvider: "openai" as EmbedderProvider,
		modelId: undefined as string | undefined,
		modelDimension: undefined as number | undefined,
		openAiOptions: undefined as ApiHandlerOptions | undefined,
		ollamaOptions: undefined as ApiHandlerOptions | undefined,
		openAiCompatibleOptions: undefined as
			| {
					baseUrl: string
					apiKey: string
			  }
			| undefined,
		geminiOptions: undefined as
			| {
					apiKey: string
			  }
			| undefined,
		mistralOptions: undefined as
			| {
					apiKey: string
			  }
			| undefined,
		vercelAiGatewayOptions: undefined as
			| {
					apiKey: string
			  }
			| undefined,
		bedrockOptions: undefined as
			| {
					region: string
					profile?: string
			  }
			| undefined,
		openRouterOptions: undefined as
			| {
					apiKey: string
					specificProvider?: string
			  }
			| undefined,
		qdrantUrl: "http://localhost:6333" as string | undefined,
		qdrantApiKey: undefined as string | undefined,
		searchMinScore: undefined as number | undefined,
		searchMaxResults: undefined as number | undefined,
		contextProxy,
		applyConfig(config: LoadedConfig | undefined): void {
			if (!config) return
			handler.codebaseIndexEnabled = config.codebaseIndexEnabled
			handler.qdrantUrl = config.qdrantUrl
			handler.qdrantApiKey = config.qdrantApiKey ?? ""
			handler.searchMinScore = config.searchMinScore
			handler.searchMaxResults = config.searchMaxResults
			handler.modelDimension = config.modelDimension
			handler.embedderProvider = config.embedderProvider
			handler.modelId = config.modelId
			handler.openAiOptions = config.openAiOptions
			handler.ollamaOptions = config.ollamaOptions
			handler.openAiCompatibleOptions = config.openAiCompatibleOptions
			handler.geminiOptions = config.geminiOptions
			handler.mistralOptions = config.mistralOptions
			handler.vercelAiGatewayOptions = config.vercelAiGatewayOptions
			handler.openRouterOptions = config.openRouterOptions
			handler.bedrockOptions = config.bedrockOptions
		},
		getContextProxy(): IHostEnvironment {
			return handler.contextProxy
		},
		async loadConfiguration(): Promise<LoadConfigurationResult> {
			const previousConfigSnapshot = buildSnapshot(this)
			await handler.contextProxy.refreshSecrets()
			handler.applyConfig(loadConfigFromContext(handler.contextProxy))
			const requiresRestart = computeRestartRequired(previousConfigSnapshot, this, handler.isConfigured())
			return {
				configSnapshot: previousConfigSnapshot,
				currentConfig: {
					isConfigured: handler.isConfigured(),
					embedderProvider: handler.embedderProvider,
					modelId: handler.modelId,
					modelDimension: handler.modelDimension,
					openAiOptions: handler.openAiOptions,
					ollamaOptions: handler.ollamaOptions,
					openAiCompatibleOptions: handler.openAiCompatibleOptions,
					geminiOptions: handler.geminiOptions,
					mistralOptions: handler.mistralOptions,
					vercelAiGatewayOptions: handler.vercelAiGatewayOptions,
					bedrockOptions: handler.bedrockOptions,
					openRouterOptions: handler.openRouterOptions,
					qdrantUrl: handler.qdrantUrl,
					qdrantApiKey: handler.qdrantApiKey,
					searchMinScore: handler.currentSearchMinScore,
				},
				requiresRestart,
			}
		},
		isConfigured(): boolean {
			const checker = CONFIG_CHECKERS[handler.embedderProvider]
			return checker ? checker(this) : false
		},
		doesConfigChangeRequireRestart(prev: PreviousConfigSnapshot | undefined): boolean {
			return computeRestartRequired(prev, this, handler.isConfigured())
		},
		getConfig(): CodeIndexConfig {
			return {
				isConfigured: handler.isConfigured(),
				embedderProvider: handler.embedderProvider,
				modelId: handler.modelId,
				modelDimension: handler.modelDimension,
				openAiOptions: handler.openAiOptions,
				ollamaOptions: handler.ollamaOptions,
				openAiCompatibleOptions: handler.openAiCompatibleOptions,
				geminiOptions: handler.geminiOptions,
				mistralOptions: handler.mistralOptions,
				vercelAiGatewayOptions: handler.vercelAiGatewayOptions,
				bedrockOptions: handler.bedrockOptions,
				openRouterOptions: handler.openRouterOptions,
				qdrantUrl: handler.qdrantUrl,
				qdrantApiKey: handler.qdrantApiKey,
				searchMinScore: handler.currentSearchMinScore,
				searchMaxResults: handler.currentSearchMaxResults,
			}
		},
	}
	return handler
}
export type CodeIndexConfigManager = ReturnType<typeof CodeIndexConfigManager>
