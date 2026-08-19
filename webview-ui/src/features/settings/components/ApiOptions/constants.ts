import type { ProviderName, ProviderSettings } from "@jabberwock/types"
import {
	anthropicDefaultModelId,
	basetenDefaultModelId,
	bedrockDefaultModelId,
	deepSeekDefaultModelId,
	fireworksDefaultModelId,
	geminiDefaultModelId,
	internationalZAiDefaultModelId,
	litellmDefaultModelId,
	mainlandZAiDefaultModelId,
	minimaxDefaultModelId,
	mistralDefaultModelId,
	moonshotDefaultModelId,
	openAiCodexDefaultModelId,
	openAiNativeDefaultModelId,
	openRouterDefaultModelId,
	qwenCodeDefaultModelId,
	requestyDefaultModelId,
	rooDefaultModelId,
	sambaNovaDefaultModelId,
	unboundDefaultModelId,
	vercelAiGatewayDefaultModelId,
	xaiDefaultModelId,
} from "@jabberwock/types"
import type { ProviderModelConfig } from "./types"

export const PROVIDER_MODEL_CONFIG: Partial<Record<ProviderName, ProviderModelConfig>> = {
	openrouter: { field: "openRouterModelId", default: openRouterDefaultModelId },
	requesty: { field: "requestyModelId", default: requestyDefaultModelId },
	unbound: { field: "unboundModelId", default: unboundDefaultModelId },
	litellm: { field: "litellmModelId", default: litellmDefaultModelId },
	anthropic: { field: "apiModelId", default: anthropicDefaultModelId },
	"openai-codex": { field: "apiModelId", default: openAiCodexDefaultModelId },
	"qwen-code": { field: "apiModelId", default: qwenCodeDefaultModelId },
	"openai-native": { field: "apiModelId", default: openAiNativeDefaultModelId },
	gemini: { field: "apiModelId", default: geminiDefaultModelId },
	deepseek: { field: "apiModelId", default: deepSeekDefaultModelId },
	moonshot: { field: "apiModelId", default: moonshotDefaultModelId },
	minimax: { field: "apiModelId", default: minimaxDefaultModelId },
	mistral: { field: "apiModelId", default: mistralDefaultModelId },
	xai: { field: "apiModelId", default: xaiDefaultModelId },
	baseten: { field: "apiModelId", default: basetenDefaultModelId },
	bedrock: { field: "apiModelId", default: bedrockDefaultModelId },
	vertex: { field: "apiModelId", default: bedrockDefaultModelId },
	sambanova: { field: "apiModelId", default: sambaNovaDefaultModelId },
	fireworks: { field: "apiModelId", default: fireworksDefaultModelId },
	jabberwock: { field: "apiModelId", default: rooDefaultModelId },
	"vercel-ai-gateway": { field: "vercelAiGatewayModelId", default: vercelAiGatewayDefaultModelId },
	openai: { field: "openAiModelId" },
	ollama: { field: "ollamaModelId" },
	lmstudio: { field: "lmStudioModelId" },
}

export function getZaiDefaultModelId(apiConfiguration: ProviderSettings): string {
	return apiConfiguration.zaiApiLine === "china_coding" ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId
}
