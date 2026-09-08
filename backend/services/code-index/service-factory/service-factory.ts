import type { IExtensionContextView } from "@features/foundation/host-context/context"
import { getConfiguration } from "@features/foundation/capabilities/registry"
import { Ignore } from "ignore"

import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"

import { t } from "@i18n"

import { getDefaultModelId, getModelDimension } from "@shared/api/embeddingModels"
import { Package } from "@shared/package"

import { QdrantVectorStore } from "@services/code-index/vector-store/qdrant-client"
import { codeParser, DirectoryScanner, FileWatcher } from "@services/code-index/processors"
import type { ICodeParser, IEmbedder, IFileWatcher, IVectorStore } from "@services/code-index/interfaces"
import { CodeIndexConfigManager } from "@services/code-index/config/manager"
import { CacheManager } from "@services/code-index/cache-manager"

import { BATCH_SEGMENT_THRESHOLD } from "@services/code-index/constants"
import { EMBEDDER_FACTORIES } from "./embedder-factories"

export class CodeIndexServiceFactory {
	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly workspacePath: string,
		private readonly cacheManager: CacheManager,
	) {}

	public createEmbedder(): IEmbedder {
		const config = this.configManager.getConfig()
		const factory = EMBEDDER_FACTORIES[config.embedderProvider]
		if (!factory) {
			throw new Error(
				t("embeddings:serviceFactory.invalidEmbedderType", { embedderProvider: config.embedderProvider }),
			)
		}
		return factory(config)
	}

	public async validateEmbedder(embedder: IEmbedder): Promise<{ valid: boolean; error?: string }> {
		try {
			return await embedder.validateConfiguration()
		} catch (error) {
			getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "validateEmbedder",
			})

			return {
				valid: false,
				error: error instanceof Error ? error.message : "embeddings:validation.configurationError",
			}
		}
	}

	public createVectorStore(): IVectorStore {
		const config = this.configManager.getConfig()

		const provider = config.embedderProvider
		const defaultModel = getDefaultModelId(provider)
		const modelId = config.modelId ?? defaultModel

		let vectorSize: number | undefined

		vectorSize = getModelDimension(provider, modelId)

		if (!vectorSize && config.modelDimension && config.modelDimension > 0) {
			vectorSize = config.modelDimension
		}

		if (vectorSize === undefined || vectorSize <= 0) {
			if (provider === "openai-compatible") {
				throw new Error(
					t("embeddings:serviceFactory.vectorDimensionNotDeterminedOpenAiCompatible", { modelId, provider }),
				)
			} else {
				throw new Error(t("embeddings:serviceFactory.vectorDimensionNotDetermined", { modelId, provider }))
			}
		}

		if (!config.qdrantUrl) {
			throw new Error(t("embeddings:serviceFactory.qdrantUrlMissing"))
		}

		return new QdrantVectorStore(this.workspacePath, config.qdrantUrl, vectorSize, config.qdrantApiKey)
	}

	public createDirectoryScanner(
		embedder: IEmbedder,
		vectorStore: IVectorStore,
		parser: ICodeParser,
		ignoreInstance: Ignore,
	): DirectoryScanner {
		let batchSize: number
		try {
			// D4g-2 (batch 3): config read via the capability slot (D4b).
			batchSize =
				getConfiguration().get<number>(Package.name, "codeIndex.embeddingBatchSize", BATCH_SEGMENT_THRESHOLD) ??
				BATCH_SEGMENT_THRESHOLD
		} catch {
			batchSize = BATCH_SEGMENT_THRESHOLD
		}
		return new DirectoryScanner(embedder, vectorStore, parser, this.cacheManager, ignoreInstance, batchSize)
	}

	public createFileWatcher(
		/** v4 B2 (L3): structural context view — real host contexts satisfy it structurally. */
		context: IExtensionContextView,
		embedder: IEmbedder,
		vectorStore: IVectorStore,
		cacheManager: CacheManager,
		ignoreInstance: Ignore,
		ignoreState: string | undefined,
	): IFileWatcher {
		let batchSize: number
		try {
			// D4g-2 (batch 3): config read via the capability slot (D4b).
			batchSize =
				getConfiguration().get<number>(Package.name, "codeIndex.embeddingBatchSize", BATCH_SEGMENT_THRESHOLD) ??
				BATCH_SEGMENT_THRESHOLD
		} catch {
			batchSize = BATCH_SEGMENT_THRESHOLD
		}
		return new FileWatcher(
			this.workspacePath,
			context,
			cacheManager,
			embedder,
			vectorStore,
			ignoreInstance,
			ignoreState,
			batchSize,
		)
	}

	public createServices(
		/** v4 B2 (L3): structural context view — real host contexts satisfy it structurally. */
		context: IExtensionContextView,
		cacheManager: CacheManager,
		ignoreInstance: Ignore,
		ignorePatterns?: string,
	): {
		embedder: IEmbedder
		vectorStore: IVectorStore
		parser: ICodeParser
		scanner: DirectoryScanner
		fileWatcher: IFileWatcher
	} {
		if (!this.configManager.isFeatureConfigured) {
			throw new Error(t("embeddings:serviceFactory.codeIndexingNotConfigured"))
		}

		const embedder = this.createEmbedder()
		const vectorStore = this.createVectorStore()
		const parser = codeParser
		const scanner = this.createDirectoryScanner(embedder, vectorStore, parser, ignoreInstance)
		const fileWatcher = this.createFileWatcher(
			context,
			embedder,
			vectorStore,
			cacheManager,
			ignoreInstance,
			ignorePatterns,
		)

		return {
			embedder,
			vectorStore,
			parser,
			scanner,
			fileWatcher,
		}
	}
}
