import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "@services/code-index/interfaces/embedder"
import { GEMINI_MAX_ITEM_TOKENS } from "@services/code-index/constants"
import { t } from "@i18n"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
const GEMINI_DEFAULT_MODEL = "gemini-embedding-001"
const DEPRECATED_MODEL_MIGRATIONS: Record<string, string> = {
	"text-embedding-004": "gemini-embedding-001",
}

function migrateModelId(modelId: string): string {
	return DEPRECATED_MODEL_MIGRATIONS[modelId] ?? modelId
}

export function GeminiEmbedder(apiKey: string, modelId?: string): IEmbedder {
	if (!apiKey) {
		throw new Error(t("embeddings:validation.apiKeyRequired"))
	}

	const migratedModelId = modelId ? migrateModelId(modelId) : undefined
	const resolvedModelId = migratedModelId || GEMINI_DEFAULT_MODEL

	const openAICompatibleEmbedder = OpenAICompatibleEmbedder(
		GEMINI_BASE_URL,
		apiKey,
		resolvedModelId,
		GEMINI_MAX_ITEM_TOKENS,
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
					location: "GeminiEmbedder:createEmbeddings",
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
					location: "GeminiEmbedder:validateConfiguration",
				})
				throw error
			}
		},
		get embedderInfo(): EmbedderInfo {
			return {
				name: "gemini",
			}
		},
	}
	return handler
}
