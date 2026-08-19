import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelCommandInput } from "@aws-sdk/client-bedrock-runtime"
import { fromIni, fromNodeProviderChain } from "@aws-sdk/credential-providers"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "@services/code-index/interfaces"
import {
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
} from "@services/code-index/constants"
import { getDefaultModelId } from "@shared/api/embeddingModels"
import { Package } from "@shared/package"
import { t } from "@i18n"
import { withValidationErrorHandling, formatEmbeddingError } from "@services/code-index/shared/validateContent"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import {
	buildBedrockRequestBody,
	buildTextBatch,
	parseBedrockResponse,
	handleRetryAttemptError,
	handleBedrockValidationError,
} from "./bedrock.helpers"

export class BedrockEmbedder implements IEmbedder {
	private bedrockClient: BedrockRuntimeClient
	private readonly defaultModelId: string

	constructor(
		private readonly region: string,
		private readonly profile?: string,
		modelId?: string,
	) {
		if (!region) {
			throw new Error("Region is required for AWS Bedrock embedder")
		}

		const credentials = this.profile ? fromIni({ profile: this.profile }) : fromNodeProviderChain()

		this.bedrockClient = new BedrockRuntimeClient({
			userAgentAppId: `Jabberwock#${Package.version}`,
			region: this.region,
			credentials,
		})

		this.defaultModelId = modelId || getDefaultModelId("bedrock")
	}

	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.defaultModelId
		const allEmbeddings: number[][] = []
		const usage = { promptTokens: 0, totalTokens: 0 }
		const remainingTexts = [...texts]

		while (remainingTexts.length > 0) {
			const { batch, processedIndices } = buildTextBatch(remainingTexts, MAX_ITEM_TOKENS, MAX_BATCH_TOKENS)

			for (let i = processedIndices.length - 1; i >= 0; i--) {
				remainingTexts.splice(processedIndices[i], 1)
			}

			if (batch.length > 0) {
				const batchResult = await this._embedBatchWithRetries(batch, modelToUse)
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
			try {
				const embeddings: number[][] = []
				let totalPromptTokens = 0
				let totalTokens = 0

				for (const text of batchTexts) {
					const embedding = await this._invokeEmbeddingModel(text, model)
					embeddings.push(embedding.embedding)
					totalPromptTokens += embedding.inputTextTokenCount || 0
					totalTokens += embedding.inputTextTokenCount || 0
				}

				return {
					embeddings,
					usage: { promptTokens: totalPromptTokens, totalTokens },
				}
			} catch (error) {
				if (handleRetryAttemptError(error, attempts, MAX_RETRIES)) {
					const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempts)
					console.warn(
						t("embeddings:rateLimitRetry", {
							delayMs,
							attempt: attempts + 1,
							maxRetries: MAX_RETRIES,
						}),
					)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
					continue
				}

				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "BedrockEmbedder:_embedBatchWithRetries",
					attempt: attempts + 1,
				})

				throw formatEmbeddingError(error, MAX_RETRIES)
			}
		}

		throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
	}

	private async _invokeEmbeddingModel(
		text: string,
		model: string,
	): Promise<{ embedding: number[]; inputTextTokenCount?: number }> {
		const requestBody = buildBedrockRequestBody(text, model)

		const params: InvokeModelCommandInput = {
			modelId: model,
			body: JSON.stringify(requestBody),
			contentType: "application/json",
			accept: "application/json",
		}

		const command = new InvokeModelCommand(params)
		const response = await this.bedrockClient.send(command)
		const responseBody = JSON.parse(new TextDecoder().decode(response.body))

		return parseBedrockResponse(responseBody, model)
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(async () => {
			try {
				const result = await this._invokeEmbeddingModel("test", this.defaultModelId)

				if (!result.embedding || result.embedding.length === 0) {
					return {
						valid: false,
						error: t("embeddings:bedrock.invalidResponseFormat"),
					}
				}

				return { valid: true }
			} catch (error) {
				const validationError = handleBedrockValidationError(error, this.defaultModelId)
				if (validationError) {
					return validationError
				}

				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "BedrockEmbedder:validateConfiguration",
				})
				throw error
			}
		}, "bedrock")
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "bedrock",
		}
	}
}
