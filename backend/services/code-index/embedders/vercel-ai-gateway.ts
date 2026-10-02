import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "@services/code-index/interfaces/embedder"
import { MAX_ITEM_TOKENS } from "@services/code-index/constants"
import { t } from "@i18n"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

const VERCEL_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1"
const VERCEL_AI_GATEWAY_DEFAULT_MODEL = "openai/text-embedding-3-large"

export function VercelAiGatewayEmbedder(apiKey: string, modelId?: string): IEmbedder {
	if (!apiKey) {
		throw new Error(t("embeddings:validation.apiKeyRequired"))
	}

	const resolvedModelId = modelId || VERCEL_AI_GATEWAY_DEFAULT_MODEL

	const openAICompatibleEmbedder = OpenAICompatibleEmbedder(
		VERCEL_AI_GATEWAY_BASE_URL,
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
					location: "VercelAiGatewayEmbedder:createEmbeddings",
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
					location: "VercelAiGatewayEmbedder:validateConfiguration",
				})
				throw error
			}
		},
		get embedderInfo(): EmbedderInfo {
			return {
				name: "vercel-ai-gateway",
			}
		},
	}
	return handler
}
