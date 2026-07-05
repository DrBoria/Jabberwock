import { ApiHandlerOptions } from "@shared/api"
import { EmbedderInfo, EmbeddingResponse, IEmbedder } from "@services/code-index/interfaces"
import { getModelQueryPrefix } from "@shared/api/embeddingModels"
import { t } from "@i18n"
import { withValidationErrorHandling } from "@services/code-index/shared/validateContent"
import { sanitizeErrorMessage } from "@services/code-index/shared/sanitizeInput"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import {
	extractErrorName,
	extractErrorMessage,
	extractErrorCode,
	isOllamaConnectionFailed,
	isOllamaHostNotFound,
	captureOllamaError,
	applyQueryPrefix,
} from "./error-utils"

// Timeout constants for Ollama API requests
const OLLAMA_EMBEDDING_TIMEOUT_MS = 60000 // 60 seconds for embedding requests
const OLLAMA_VALIDATION_TIMEOUT_MS = 30000 // 30 seconds for validation requests

export class CodeIndexOllamaEmbedder implements IEmbedder {
	private readonly baseUrl: string
	private readonly defaultModelId: string

	constructor(options: ApiHandlerOptions) {
		// Ensure ollamaBaseUrl and ollamaModelId exist on ApiHandlerOptions or add defaults
		let baseUrl = options.ollamaBaseUrl || "http://localhost:11434"

		// Normalize the baseUrl by removing all trailing slashes
		baseUrl = baseUrl.replace(/\/+$/, "")

		this.baseUrl = baseUrl
		this.defaultModelId = options.ollamaModelId || "nomic-embed-text:latest"
	}

	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.defaultModelId
		const url = `${this.baseUrl}/api/embed`

		const queryPrefix = getModelQueryPrefix("ollama", modelToUse)
		const processedTexts = queryPrefix
			? texts.map((text, index) => applyQueryPrefix(text, index, queryPrefix))
			: texts

		try {
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), OLLAMA_EMBEDDING_TIMEOUT_MS)

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: modelToUse,
					input: processedTexts,
				}),
				signal: controller.signal,
			})
			clearTimeout(timeoutId)

			if (!response.ok) {
				let errorBody = t("embeddings:ollama.couldNotReadErrorBody")
				try {
					errorBody = await response.text()
				} catch (_e) {
					// Ignore error reading body
				}
				throw new Error(
					t("embeddings:ollama.requestFailed", {
						status: response.status,
						statusText: response.statusText,
						errorBody,
					}),
				)
			}

			const data = await response.json()
			const embeddings = data.embeddings
			if (!embeddings || !Array.isArray(embeddings)) {
				throw new Error(t("embeddings:ollama.invalidResponseStructure"))
			}

			return { embeddings }
		} catch (error) {
			throw captureOllamaError(error, this.baseUrl)
		}
	}

	private handleOllamaValidateError(error: unknown): { valid: boolean; error: string } | undefined {
		const errMessage = extractErrorMessage(error)
		const errCode = extractErrorCode(error)
		const errName = extractErrorName(error)

		if (isOllamaConnectionFailed(errMessage, errCode)) {
			return this.buildOllamaErrorResult(
				error,
				"OllamaEmbedder:validateConfiguration:connectionFailed",
				t("embeddings:ollama.serviceNotRunning", { baseUrl: this.baseUrl }),
			)
		}

		if (isOllamaHostNotFound(errCode, errMessage)) {
			return this.buildOllamaErrorResult(
				error,
				"OllamaEmbedder:validateConfiguration:hostNotFound",
				t("embeddings:ollama.hostNotFound", { baseUrl: this.baseUrl }),
			)
		}

		if (errName === "AbortError") {
			return this.buildOllamaErrorResult(
				error,
				"OllamaEmbedder:validateConfiguration:timeout",
				t("embeddings:validation.connectionFailed"),
			)
		}

		return undefined
	}

	private buildOllamaErrorResult(
		error: unknown,
		location: string,
		errorMessage: string,
	): { valid: boolean; error: string } {
		getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
			error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
			stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
			location,
		})
		return { valid: false, error: errorMessage }
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(
			async () => {
				// First check if Ollama service is running by trying to list models
				const modelsUrl = `${this.baseUrl}/api/tags`

				// Add timeout to prevent indefinite hanging
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), OLLAMA_VALIDATION_TIMEOUT_MS)

				const modelsResponse = await fetch(modelsUrl, {
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
					signal: controller.signal,
				})
				clearTimeout(timeoutId)

				if (!modelsResponse.ok) {
					if (modelsResponse.status === 404) {
						return {
							valid: false,
							error: t("embeddings:ollama.serviceNotRunning", { baseUrl: this.baseUrl }),
						}
					}
					return {
						valid: false,
						error: t("embeddings:ollama.serviceUnavailable", {
							baseUrl: this.baseUrl,
							status: modelsResponse.status,
						}),
					}
				}

				// Check if the specific model exists
				const modelsData = await modelsResponse.json()
				const models = modelsData.models || []

				// Check both with and without :latest suffix
				const modelExists = models.some((m: { name?: string }) => {
					const modelName = m.name || ""
					return (
						modelName === this.defaultModelId ||
						modelName === `${this.defaultModelId}:latest` ||
						modelName === this.defaultModelId.replace(":latest", "")
					)
				})

				if (!modelExists) {
					const availableModels = models.map((m: { name?: string }) => m.name).join(", ")
					return {
						valid: false,
						error: t("embeddings:ollama.modelNotFound", {
							modelId: this.defaultModelId,
							availableModels,
						}),
					}
				}

				// Try a test embedding to ensure the model works for embeddings
				const testUrl = `${this.baseUrl}/api/embed`

				// Add timeout for test request too
				const testController = new AbortController()
				const testTimeoutId = setTimeout(() => testController.abort(), OLLAMA_VALIDATION_TIMEOUT_MS)

				const testResponse = await fetch(testUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: this.defaultModelId,
						input: ["test"],
					}),
					signal: testController.signal,
				})
				clearTimeout(testTimeoutId)

				if (!testResponse.ok) {
					return {
						valid: false,
						error: t("embeddings:ollama.modelNotEmbeddingCapable", { modelId: this.defaultModelId }),
					}
				}

				return { valid: true }
			},
			"ollama",
			{
				beforeStandardHandling: (error: unknown) => {
					return this.handleOllamaValidateError(error)
				},
			},
		)
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "ollama",
		}
	}
}
