import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "@services/code-index/interfaces/embedder"
import { MAX_ITEM_TOKENS } from "@services/code-index/constants"
import { t } from "@i18n"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

const MISTRAL_BASE_URL = "https://api.mistral.ai/v1"
const MISTRAL_DEFAULT_MODEL = "codestral-embed-2505"

export function MistralEmbedder(apiKey: string, modelId?: string): IEmbedder {
	if (!apiKey) {
		throw new Error(t("embeddings:validation.apiKeyRequired"))
	}

	const resolvedModelId = modelId || MISTRAL_DEFAULT_MODEL

	const openAICompatibleEmbedder = OpenAICompatibleEmbedder(
		MISTRAL_BASE_URL,
		apiKey,
		resolvedModelId,
		MAX_ITEM_TOKENS,
	)

	const handler = {
		openAICompatibleEmbedder,
		modelId: resolvedModelId,
		async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
			try {
				const modelToUse = model || handler.modelId
				return await handler.openAICompatibleEmbedder.createEmbeddings(texts, modelToUse)
			} catch (error) {
				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "MistralEmbedder:createEmbeddings",
				})
				throw error
			}
		},
		async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
			try {
				return await handler.openAICompatibleEmbedder.validateConfiguration()
			} catch (error) {
				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "MistralEmbedder:validateConfiguration",
				})
				throw error
			}
		},
		get embedderInfo(): EmbedderInfo {
			return {
				name: "mistral",
			}
		},
	}
	return handler
}
