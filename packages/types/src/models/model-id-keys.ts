import { TypicalProvider } from "../settings/provider/categories.ts"
import { ProviderSettings } from "../settings/provider/combined-schemas.ts"

/**
 * ModelIdKey
 */

export const modelIdKeys = [
	"apiModelId",
	"openRouterModelId",
	"openAiModelId",
	"ollamaModelId",
	"lmStudioModelId",
	"lmStudioDraftModelId",
	"requestyModelId",
	"unboundModelId",
	"litellmModelId",
	"vercelAiGatewayModelId",
] as const satisfies readonly (keyof ProviderSettings)[]

export type ModelIdKey = (typeof modelIdKeys)[number]

export const getModelId = (settings: ProviderSettings): string | undefined => {
	const modelIdKey = modelIdKeys.find((key) => settings[key])
	return modelIdKey ? settings[modelIdKey] : undefined
}

export const modelIdKeysByProvider: Record<TypicalProvider, ModelIdKey> = {
	anthropic: "apiModelId",
	openrouter: "openRouterModelId",
	bedrock: "apiModelId",
	vertex: "apiModelId",
	"openai-codex": "apiModelId",
	"openai-native": "openAiModelId",
	ollama: "ollamaModelId",
	lmstudio: "lmStudioModelId",
	gemini: "apiModelId",
	"gemini-cli": "apiModelId",
	mistral: "apiModelId",
	moonshot: "apiModelId",
	minimax: "apiModelId",
	deepseek: "apiModelId",
	"qwen-code": "apiModelId",
	requesty: "requestyModelId",
	unbound: "unboundModelId",
	xai: "apiModelId",
	baseten: "apiModelId",
	litellm: "litellmModelId",
	sambanova: "apiModelId",
	zai: "apiModelId",
	fireworks: "apiModelId",
	jabberwock: "apiModelId",
	"vercel-ai-gateway": "vercelAiGatewayModelId",
}
