import { OpenAiEmbedder } from "@services/code-index/embedders/openai"
import { CodeIndexOllamaEmbedder } from "@services/code-index/embedders/ollama"
import { OpenAICompatibleEmbedder } from "@services/code-index/embedders/openai-compatible"
import { GeminiEmbedder } from "@services/code-index/embedders/gemini"
import { MistralEmbedder } from "@services/code-index/embedders/mistral"
import { VercelAiGatewayEmbedder } from "@services/code-index/embedders/vercel-ai-gateway"
import { BedrockEmbedder } from "@services/code-index/embedders/bedrock"
import { OpenRouterEmbedder } from "@services/code-index/embedders/openrouter"
import type { IEmbedder } from "@services/code-index/interfaces"
import type { CodeIndexConfig } from "@services/code-index/interfaces/config"
import { t } from "@i18n"

export const EMBEDDER_FACTORIES: Record<string, (config: CodeIndexConfig) => IEmbedder> = {
	openai: (config) => {
		const apiKey = config.openAiOptions?.openAiNativeApiKey
		if (!apiKey) {
			throw new Error(t("embeddings:serviceFactory.openAiConfigMissing"))
		}
		return new OpenAiEmbedder({
			...config.openAiOptions,
			openAiEmbeddingModelId: config.modelId,
		})
	},
	ollama: (config) => {
		if (!config.ollamaOptions?.ollamaBaseUrl) {
			throw new Error(t("embeddings:serviceFactory.ollamaConfigMissing"))
		}
		return new CodeIndexOllamaEmbedder({
			...config.ollamaOptions,
			ollamaModelId: config.modelId,
		})
	},
	"openai-compatible": (config) => {
		const baseUrl = config.openAiCompatibleOptions?.baseUrl
		const apiKey = config.openAiCompatibleOptions?.apiKey
		if (!baseUrl || !apiKey) {
			throw new Error(t("embeddings:serviceFactory.openAiCompatibleConfigMissing"))
		}
		return new OpenAICompatibleEmbedder(baseUrl, apiKey, config.modelId)
	},
	gemini: (config) => {
		if (!config.geminiOptions?.apiKey) {
			throw new Error(t("embeddings:serviceFactory.geminiConfigMissing"))
		}
		return new GeminiEmbedder(config.geminiOptions.apiKey, config.modelId)
	},
	mistral: (config) => {
		if (!config.mistralOptions?.apiKey) {
			throw new Error(t("embeddings:serviceFactory.mistralConfigMissing"))
		}
		return new MistralEmbedder(config.mistralOptions.apiKey, config.modelId)
	},
	"vercel-ai-gateway": (config) => {
		if (!config.vercelAiGatewayOptions?.apiKey) {
			throw new Error(t("embeddings:serviceFactory.vercelAiGatewayConfigMissing"))
		}
		return new VercelAiGatewayEmbedder(config.vercelAiGatewayOptions.apiKey, config.modelId)
	},
	bedrock: (config) => {
		if (!config.bedrockOptions?.region) {
			throw new Error(t("embeddings:serviceFactory.bedrockConfigMissing"))
		}
		return new BedrockEmbedder(config.bedrockOptions.region, config.bedrockOptions.profile, config.modelId)
	},
	openrouter: (config) => {
		if (!config.openRouterOptions?.apiKey) {
			throw new Error(t("embeddings:serviceFactory.openRouterConfigMissing"))
		}
		return new OpenRouterEmbedder(
			config.openRouterOptions.apiKey,
			config.modelId,
			undefined,
			config.openRouterOptions.specificProvider,
		)
	},
}
