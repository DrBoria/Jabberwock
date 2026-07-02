import { ApiHandlerOptions } from "@shared/api"
import type { VscodeContextAccess } from "@features/foundation/vscode/context"
import { EmbedderProvider } from "@services/code-index/interfaces/manager"
import { CodeIndexConfig, PreviousConfigSnapshot } from "@services/code-index/interfaces/config"
import { DEFAULT_SEARCH_MIN_SCORE, DEFAULT_MAX_SEARCH_RESULTS } from "@services/code-index/constants"
import { getDefaultModelId, getModelDimension, getModelScoreThreshold } from "@shared/api/embeddingModels"
import { ConfigManagerFields, CONFIG_CHECKERS, buildSnapshot } from "./snapshot"
import { LoadedConfig, loadConfigFromContext, LoadConfigurationResult, computeRestartRequired } from "./loading"

/**
 * Manages configuration state and validation for the code indexing feature.
 * Handles loading, validating, and providing access to configuration values.
 */
export class CodeIndexConfigManager implements ConfigManagerFields {
	codebaseIndexEnabled: boolean = false
	embedderProvider: EmbedderProvider = "openai"
	modelId?: string
	modelDimension?: number
	openAiOptions?: ApiHandlerOptions
	ollamaOptions?: ApiHandlerOptions
	openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
	geminiOptions?: { apiKey: string }
	mistralOptions?: { apiKey: string }
	vercelAiGatewayOptions?: { apiKey: string }
	bedrockOptions?: { region: string; profile?: string }
	openRouterOptions?: { apiKey: string; specificProvider?: string }
	qdrantUrl?: string = "http://localhost:6333"
	qdrantApiKey?: string
	searchMinScore?: number
	searchMaxResults?: number

	constructor(private readonly contextProxy: VscodeContextAccess) {
		this.applyConfig(loadConfigFromContext(this.contextProxy))
	}

	private applyConfig(config: LoadedConfig | undefined): void {
		if (!config) return

		this.codebaseIndexEnabled = config.codebaseIndexEnabled
		this.qdrantUrl = config.qdrantUrl
		this.qdrantApiKey = config.qdrantApiKey ?? ""
		this.searchMinScore = config.searchMinScore
		this.searchMaxResults = config.searchMaxResults
		this.modelDimension = config.modelDimension
		this.embedderProvider = config.embedderProvider
		this.modelId = config.modelId
		this.openAiOptions = config.openAiOptions
		this.ollamaOptions = config.ollamaOptions
		this.openAiCompatibleOptions = config.openAiCompatibleOptions
		this.geminiOptions = config.geminiOptions
		this.mistralOptions = config.mistralOptions
		this.vercelAiGatewayOptions = config.vercelAiGatewayOptions
		this.openRouterOptions = config.openRouterOptions
		this.bedrockOptions = config.bedrockOptions
	}

	/**
	 * Gets the context proxy instance
	 */
	public getContextProxy(): VscodeContextAccess {
		return this.contextProxy
	}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<LoadConfigurationResult> {
		const previousConfigSnapshot = buildSnapshot(this)

		await this.contextProxy.refreshSecrets()

		this.applyConfig(loadConfigFromContext(this.contextProxy))

		const requiresRestart = computeRestartRequired(previousConfigSnapshot, this, this.isConfigured())

		return {
			configSnapshot: previousConfigSnapshot,
			currentConfig: {
				isConfigured: this.isConfigured(),
				embedderProvider: this.embedderProvider,
				modelId: this.modelId,
				modelDimension: this.modelDimension,
				openAiOptions: this.openAiOptions,
				ollamaOptions: this.ollamaOptions,
				openAiCompatibleOptions: this.openAiCompatibleOptions,
				geminiOptions: this.geminiOptions,
				mistralOptions: this.mistralOptions,
				vercelAiGatewayOptions: this.vercelAiGatewayOptions,
				bedrockOptions: this.bedrockOptions,
				openRouterOptions: this.openRouterOptions,
				qdrantUrl: this.qdrantUrl,
				qdrantApiKey: this.qdrantApiKey,
				searchMinScore: this.currentSearchMinScore,
			},
			requiresRestart,
		}
	}

	/**
	 * Checks if the service is properly configured based on the embedder type.
	 */
	public isConfigured(): boolean {
		const checker = CONFIG_CHECKERS[this.embedderProvider]
		return checker ? checker(this) : false
	}

	/**
	 * Determines if a configuration change requires restarting the indexing process.
	 */
	public doesConfigChangeRequireRestart(prev: PreviousConfigSnapshot | undefined): boolean {
		return computeRestartRequired(prev, this, this.isConfigured())
	}

	/**
	 * Gets the current configuration state.
	 */
	public getConfig(): CodeIndexConfig {
		return {
			isConfigured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			modelDimension: this.modelDimension,
			openAiOptions: this.openAiOptions,
			ollamaOptions: this.ollamaOptions,
			openAiCompatibleOptions: this.openAiCompatibleOptions,
			geminiOptions: this.geminiOptions,
			mistralOptions: this.mistralOptions,
			vercelAiGatewayOptions: this.vercelAiGatewayOptions,
			bedrockOptions: this.bedrockOptions,
			openRouterOptions: this.openRouterOptions,
			qdrantUrl: this.qdrantUrl,
			qdrantApiKey: this.qdrantApiKey,
			searchMinScore: this.currentSearchMinScore,
			searchMaxResults: this.currentSearchMaxResults,
		}
	}

	public get isFeatureEnabled(): boolean {
		return this.codebaseIndexEnabled
	}

	public get isFeatureConfigured(): boolean {
		return this.isConfigured()
	}

	public get currentEmbedderProvider(): EmbedderProvider {
		return this.embedderProvider
	}

	public get qdrantConfig(): { url?: string; apiKey?: string } {
		return {
			url: this.qdrantUrl,
			apiKey: this.qdrantApiKey,
		}
	}

	public get currentModelId(): string | undefined {
		return this.modelId
	}

	public get currentModelDimension(): number | undefined {
		const modelId = this.modelId ?? getDefaultModelId(this.embedderProvider)
		const modelDimension = getModelDimension(this.embedderProvider, modelId)

		if (!modelDimension && this.modelDimension && this.modelDimension > 0) {
			return this.modelDimension
		}

		return modelDimension
	}

	public get currentSearchMinScore(): number {
		if (this.searchMinScore !== undefined) {
			return this.searchMinScore
		}

		const currentModelId = this.modelId ?? getDefaultModelId(this.embedderProvider)
		const modelSpecificThreshold = getModelScoreThreshold(this.embedderProvider, currentModelId)
		return modelSpecificThreshold ?? DEFAULT_SEARCH_MIN_SCORE
	}

	public get currentSearchMaxResults(): number {
		return this.searchMaxResults ?? DEFAULT_MAX_SEARCH_RESULTS
	}
}
