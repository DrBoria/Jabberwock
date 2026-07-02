import { z } from "zod"
import type { EmbedderProvider } from "@jabberwock/types"

const baseSchemaDefinition = () =>
	z.object({
		codebaseIndexEnabled: z.boolean(),
		codebaseIndexQdrantUrl: z
			.string()
			.min(1, "settings:codeIndex.validation.qdrantUrlRequired")
			.url("settings:codeIndex.validation.invalidQdrantUrl"),
		codeIndexQdrantApiKey: z.string().optional(),
	})

const providerSchemaExtensions: Record<
	EmbedderProvider,
	(t: (key: string, options?: Record<string, unknown>) => string) => z.ZodRawShape
> = {
	openai: (t) => ({
		codeIndexOpenAiKey: z.string().min(1, t("settings:codeIndex.validation.openaiApiKeyRequired")),
		codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
	}),
	ollama: (t) => ({
		codebaseIndexEmbedderBaseUrl: z
			.string()
			.min(1, t("settings:codeIndex.validation.ollamaBaseUrlRequired"))
			.url(t("settings:codeIndex.validation.invalidOllamaUrl")),
		codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelIdRequired")),
		codebaseIndexEmbedderModelDimension: z
			.number()
			.min(1, t("settings:codeIndex.validation.modelDimensionRequired"))
			.optional(),
	}),
	"openai-compatible": (t) => ({
		codebaseIndexOpenAiCompatibleBaseUrl: z
			.string()
			.min(1, t("settings:codeIndex.validation.baseUrlRequired"))
			.url(t("settings:codeIndex.validation.invalidBaseUrl")),
		codebaseIndexOpenAiCompatibleApiKey: z.string().min(1, t("settings:codeIndex.validation.apiKeyRequired")),
		codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelIdRequired")),
		codebaseIndexEmbedderModelDimension: z
			.number()
			.min(1, t("settings:codeIndex.validation.modelDimensionRequired")),
	}),
	gemini: (t) => ({
		codebaseIndexGeminiApiKey: z.string().min(1, t("settings:codeIndex.validation.geminiApiKeyRequired")),
		codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
	}),
	mistral: (t) => ({
		codebaseIndexMistralApiKey: z.string().min(1, t("settings:codeIndex.validation.mistralApiKeyRequired")),
		codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
	}),
	"vercel-ai-gateway": (t) => ({
		codebaseIndexVercelAiGatewayApiKey: z
			.string()
			.min(1, t("settings:codeIndex.validation.vercelAiGatewayApiKeyRequired")),
		codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
	}),
	bedrock: (t) => ({
		codebaseIndexBedrockRegion: z.string().min(1, t("settings:codeIndex.validation.bedrockRegionRequired")),
		codebaseIndexBedrockProfile: z.string().optional(),
		codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
	}),
	openrouter: (t) => ({
		codebaseIndexOpenRouterApiKey: z.string().min(1, t("settings:codeIndex.validation.openRouterApiKeyRequired")),
		codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
	}),
}

export const createValidationSchema = (
	provider: EmbedderProvider,
	t: (key: string, options?: Record<string, unknown>) => string,
) => {
	const extension = providerSchemaExtensions[provider]
	return extension ? baseSchemaDefinition().extend(extension(t)) : baseSchemaDefinition()
}
