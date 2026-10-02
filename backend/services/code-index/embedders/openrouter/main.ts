import { OpenAI } from "openai"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "@services/code-index/interfaces/embedder"
import { MAX_BATCH_TOKENS, MAX_ITEM_TOKENS, MAX_BATCH_RETRIES as MAX_RETRIES } from "@services/code-index/constants"
import { getDefaultModelId, getModelQueryPrefix } from "@shared/api/embeddingModels"
import { t } from "@i18n"
import { withValidationErrorHandling } from "@services/code-index/shared/validateContent"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { handleProviderError } from "@api/providers/utils/error-handler"
import { createGlobalRateLimitState, waitForGlobalRateLimit } from "./rate-limit"
import type { GlobalRateLimitState } from "./rate-limit"
import type { OpenRouterEmbeddingResponse } from "./types"
import { processEmbeddingResponse } from "@services/code-index/shared/processEmbeddingResponse"
import { handleOpenRouterRetryError, applyQueryPrefix } from "./utils"

export const OPENROUTER_DEFAULT_PROVIDER_NAME = "[default]"

const globalRateLimitState: GlobalRateLimitState = createGlobalRateLimitState()

export function OpenRouterEmbedder(
	apiKey: string,
	modelId?: string,
	maxItemTokens?: number,
	specificProvider?: string,
): IEmbedder {
	let baseUrl: string = "https://openrouter.ai/api/v1"
	if (!apiKey) {
		throw new Error(t("embeddings:validation.apiKeyRequired"))
	}

	specificProvider =
		specificProvider && specificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME ? specificProvider : undefined

	let embeddingsClient: OpenAI
	try {
		embeddingsClient = new OpenAI({
			baseURL: baseUrl,
			apiKey: apiKey,
			defaultHeaders: {
				"HTTP-Referer": "https://github.com/JabberwockInc/Jabberwock",
				"X-Title": "Jabberwock",
			},
		})
	} catch (error) {
		throw handleProviderError(error, "OpenRouter")
	}

	const defaultModelId = modelId || getDefaultModelId("openrouter")
	maxItemTokens = maxItemTokens || MAX_ITEM_TOKENS

	const handler = {
		get embedderInfo(): EmbedderInfo {
			return {
				name: "openrouter",
			}
		},
		embeddingsClient: embeddingsClient,
		defaultModelId: defaultModelId,
		apiKey,
		maxItemTokens: maxItemTokens,
		baseUrl: baseUrl,
		specificProvider,
		async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
			const modelToUse = model || handler.defaultModelId
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
					if (itemTokens > handler.maxItemTokens) {
						console.warn(
							t("embeddings:textExceedsTokenLimit", {
								index: i,
								itemTokens,
								maxTokens: handler.maxItemTokens,
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
					const batchResult = await handler._embedBatchWithRetries(currentBatch, modelToUse)
					allEmbeddings.push(...batchResult.embeddings)
					usage.promptTokens += batchResult.usage.promptTokens
					usage.totalTokens += batchResult.usage.totalTokens
				}
			}
			return { embeddings: allEmbeddings, usage }
		},
		async _embedBatchWithRetries(
			batchTexts: string[],
			model: string,
		): Promise<{
			embeddings: number[][]
			usage: {
				promptTokens: number
				totalTokens: number
			}
		}> {
			for (let attempts = 0; attempts < MAX_RETRIES; attempts++) {
				await waitForGlobalRateLimit(globalRateLimitState)
				try {
					const requestParams: OpenAI.Embeddings.EmbeddingCreateParams & Record<string, unknown> = {
						input: batchTexts,
						model: model,
						encoding_format: "base64",
					}
					if (handler.specificProvider) {
						requestParams.provider = {
							order: [handler.specificProvider],
							only: [handler.specificProvider],
							allow_fallbacks: false,
						}
					}
					const sdkResponse = await handler.embeddingsClient.embeddings.create(requestParams)
					const response: OpenRouterEmbeddingResponse = {
						data: sdkResponse.data.map((item) => ({
							embedding: item.embedding,
						})),
						usage: sdkResponse.usage,
					}
					return processEmbeddingResponse(response)
				} catch (error) {
					await handleOpenRouterRetryError(error, attempts, globalRateLimitState)
				}
			}
			throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
		},
		async validateConfiguration(): Promise<{
			valid: boolean
			error?: string
		}> {
			return withValidationErrorHandling(async () => {
				try {
					const testTexts = ["test"]
					const modelToUse = handler.defaultModelId
					const requestParams: OpenAI.Embeddings.EmbeddingCreateParams & Record<string, unknown> = {
						input: testTexts,
						model: modelToUse,
						encoding_format: "base64",
					}
					if (handler.specificProvider) {
						requestParams.provider = {
							order: [handler.specificProvider],
							only: [handler.specificProvider],
							allow_fallbacks: false,
						}
					}
					const sdkResponse = await handler.embeddingsClient.embeddings.create(requestParams)
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
		},
	}
	return handler
}
