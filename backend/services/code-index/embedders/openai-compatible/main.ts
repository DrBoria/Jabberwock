import { OpenAI } from "openai"

import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "@services/code-index/interfaces/embedder"
import { MAX_BATCH_TOKENS, MAX_ITEM_TOKENS, MAX_BATCH_RETRIES as MAX_RETRIES } from "@services/code-index/constants"
import { getDefaultModelId, getModelQueryPrefix } from "@shared/api/embeddingModels"
import { t } from "@i18n"
import { withValidationErrorHandling } from "@services/code-index/shared/validateContent"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { handleProviderError } from "@api/providers/utils/error-handler"

import { EmbeddingRateLimiter } from "./rate-limiter"
import { isFullEndpointUrl, makeDirectEmbeddingRequest, embedWithClient } from "./utils"
import { processEmbeddingResponse } from "@services/code-index/shared/processEmbeddingResponse"

export function OpenAICompatibleEmbedder(
	baseUrl: string,
	apiKey: string,
	modelId?: string,
	maxItemTokens?: number,
): IEmbedder {
	let rateLimiter = EmbeddingRateLimiter()
	if (!baseUrl) {
		throw new Error(t("embeddings:validation.baseUrlRequired"))
	}
	if (!apiKey) {
		throw new Error(t("embeddings:validation.apiKeyRequired"))
	}

	let embeddingsClient: OpenAI
	try {
		embeddingsClient = new OpenAI({
			baseURL: baseUrl,
			apiKey: apiKey,
		})
	} catch (error) {
		throw handleProviderError(error, "OpenAI Compatible")
	}

	const defaultModelId = modelId || getDefaultModelId("openai-compatible")
	const isFullUrl = isFullEndpointUrl(baseUrl)
	maxItemTokens = maxItemTokens || MAX_ITEM_TOKENS

	const handler = {
		get embedderInfo(): EmbedderInfo {
			return {
				name: "openai-compatible",
			}
		},
		embeddingsClient: embeddingsClient,
		defaultModelId: defaultModelId,
		baseUrl,
		apiKey,
		isFullUrl: isFullUrl,
		maxItemTokens: maxItemTokens,
		rateLimiter: rateLimiter,
		async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
			const modelToUse = model || handler.defaultModelId
			const queryPrefix = getModelQueryPrefix("openai-compatible", modelToUse)
			const processedTexts = queryPrefix
				? texts.map((text, index) => {
						if (text.startsWith(queryPrefix)) {
							return text
						}
						const prefixedText = `${queryPrefix}${text}`
						const estimatedTokens = Math.ceil(prefixedText.length / 4)
						if (estimatedTokens > MAX_ITEM_TOKENS) {
							console.warn(
								t("embeddings:textWithPrefixExceedsTokenLimit", {
									index,
									estimatedTokens,
									maxTokens: MAX_ITEM_TOKENS,
								}),
							)
							return text
						}
						return prefixedText
					})
				: texts
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
					const batchResult = await handler.embedBatchWithRetries(currentBatch, modelToUse)
					allEmbeddings.push(...batchResult.embeddings)
					usage.promptTokens += batchResult.usage.promptTokens
					usage.totalTokens += batchResult.usage.totalTokens
				}
			}
			return { embeddings: allEmbeddings, usage }
		},
		async embedBatchWithRetries(
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
				await handler.rateLimiter.waitIfRateLimited()
				try {
					const response = handler.isFullUrl
						? await makeDirectEmbeddingRequest(handler.baseUrl, handler.apiKey, batchTexts, model)
						: await embedWithClient(handler.embeddingsClient, batchTexts, model)
					return processEmbeddingResponse(response)
				} catch (error) {
					handler.captureOpenAICompatibleTelemetry(error, attempts)
					await handler.rateLimiter.handleRetryError(error, attempts)
				}
			}
			throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
		},
		captureOpenAICompatibleTelemetry(error: unknown, attempts: number): void {
			getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "OpenAICompatibleEmbedder:_embedBatchWithRetries",
				attempt: attempts + 1,
			})
		},
		async validateConfiguration(): Promise<{
			valid: boolean
			error?: string
		}> {
			return withValidationErrorHandling(async () => {
				try {
					const response = handler.isFullUrl
						? await makeDirectEmbeddingRequest(
								handler.baseUrl,
								handler.apiKey,
								["test"],
								handler.defaultModelId,
							)
						: await embedWithClient(handler.embeddingsClient, ["test"], handler.defaultModelId)
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
						location: "OpenAICompatibleEmbedder:validateConfiguration",
					})
					throw error
				}
			}, "openai-compatible")
		},
	}
	return handler
}
