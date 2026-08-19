import { OpenAI } from "openai"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "@services/code-index/interfaces/embedder"
import { MAX_BATCH_TOKENS, MAX_ITEM_TOKENS, MAX_BATCH_RETRIES as MAX_RETRIES } from "@services/code-index/constants"
import { getDefaultModelId, getModelQueryPrefix } from "@shared/api/embeddingModels"
import { t } from "@i18n"
import { withValidationErrorHandling } from "@services/code-index/shared/validateContent"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { handleProviderError } from "@api/providers/utils/error-handler"
import { createGlobalRateLimitState, waitForGlobalRateLimit } from "./openrouter.rate-limit"
import type { GlobalRateLimitState } from "./openrouter.rate-limit"
import type { OpenRouterEmbeddingResponse } from "./openrouter.types"
import { processOpenRouterEmbeddingResponse, handleOpenRouterRetryError, applyQueryPrefix } from "./openrouter.utils"

export const OPENROUTER_DEFAULT_PROVIDER_NAME = "[default]"

export class OpenRouterEmbedder implements IEmbedder {
	private embeddingsClient: OpenAI
	private readonly defaultModelId: string
	private readonly apiKey: string
	private readonly maxItemTokens: number
	private readonly baseUrl: string = "https://openrouter.ai/api/v1"
	private readonly specificProvider?: string
	private static globalRateLimitState: GlobalRateLimitState = createGlobalRateLimitState()

	constructor(apiKey: string, modelId?: string, maxItemTokens?: number, specificProvider?: string) {
		if (!apiKey) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}

		this.apiKey = apiKey
		this.specificProvider =
			specificProvider && specificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME ? specificProvider : undefined

		try {
			this.embeddingsClient = new OpenAI({
				baseURL: this.baseUrl,
				apiKey: apiKey,
				defaultHeaders: {
					"HTTP-Referer": "https://github.com/JabberwockInc/Jabberwock",
					"X-Title": "Jabberwock",
				},
			})
		} catch (error) {
			throw handleProviderError(error, "OpenRouter")
		}

		this.defaultModelId = modelId || getDefaultModelId("openrouter")
		this.maxItemTokens = maxItemTokens || MAX_ITEM_TOKENS
	}

	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.defaultModelId
		const queryPrefix = getModelQueryPrefix("openrouter", modelToUse)
		const processedTexts = applyQueryPrefix(texts, queryPrefix)
		const allEmbeddings: number[][] = []
		const usage = { promptTokens: 0, totalTokens: 0 }
		const remainingTexts = [...processedTexts]

		while (remainingTexts.length > 0) {
			const currentBatch: string[] = []
			let currentBatchTokens = 0
			const processedIndices: number[] = []

			for (let i = 0; i < remainingTexts.length; i++) {
				const text = remainingTexts[i]
				const itemTokens = Math.ceil(text.length / 4)

				if (itemTokens > this.maxItemTokens) {
					console.warn(
						t("embeddings:textExceedsTokenLimit", {
							index: i,
							itemTokens,
							maxTokens: this.maxItemTokens,
						}),
					)
					processedIndices.push(i)
					continue
				}

				if (currentBatchTokens + itemTokens <= MAX_BATCH_TOKENS) {
					currentBatch.push(text)
					currentBatchTokens += itemTokens
					processedIndices.push(i)
				} else {
					break
				}
			}

			for (let i = processedIndices.length - 1; i >= 0; i--) {
				remainingTexts.splice(processedIndices[i], 1)
			}

			if (currentBatch.length > 0) {
				const batchResult = await this._embedBatchWithRetries(currentBatch, modelToUse)
				allEmbeddings.push(...batchResult.embeddings)
				usage.promptTokens += batchResult.usage.promptTokens
				usage.totalTokens += batchResult.usage.totalTokens
			}
		}

		return { embeddings: allEmbeddings, usage }
	}

	private async _embedBatchWithRetries(
		batchTexts: string[],
		model: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		for (let attempts = 0; attempts < MAX_RETRIES; attempts++) {
			await waitForGlobalRateLimit(OpenRouterEmbedder.globalRateLimitState)

			try {
				const requestParams: OpenAI.Embeddings.EmbeddingCreateParams & Record<string, unknown> = {
					input: batchTexts,
					model: model,
					encoding_format: "base64",
				}

				if (this.specificProvider) {
					requestParams.provider = {
						order: [this.specificProvider],
						only: [this.specificProvider],
						allow_fallbacks: false,
					}
				}

				const sdkResponse = await this.embeddingsClient.embeddings.create(requestParams)
				const response: OpenRouterEmbeddingResponse = {
					data: sdkResponse.data.map((item) => ({
						embedding: item.embedding,
					})),
					usage: sdkResponse.usage,
				}

				return processOpenRouterEmbeddingResponse(response)
			} catch (error) {
				await handleOpenRouterRetryError(error, attempts, OpenRouterEmbedder.globalRateLimitState)
			}
		}

		throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(async () => {
			try {
				const testTexts = ["test"]
				const modelToUse = this.defaultModelId

				const requestParams: OpenAI.Embeddings.EmbeddingCreateParams & Record<string, unknown> = {
					input: testTexts,
					model: modelToUse,
					encoding_format: "base64",
				}

				if (this.specificProvider) {
					requestParams.provider = {
						order: [this.specificProvider],
						only: [this.specificProvider],
						allow_fallbacks: false,
					}
				}

				const sdkResponse = await this.embeddingsClient.embeddings.create(requestParams)
				const response: OpenRouterEmbeddingResponse = {
					data: sdkResponse.data.map((item) => ({
						embedding: item.embedding,
					})),
					usage: sdkResponse.usage,
				}

				if (!response?.data || response.data.length === 0) {
					return {
						valid: false,
						error: "embeddings:validation.invalidResponse",
					}
				}

				return { valid: true }
			} catch (error) {
				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "OpenRouterEmbedder:validateConfiguration",
				})
				throw error
			}
		}, "openrouter")
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "openrouter",
		}
	}
}
