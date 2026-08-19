import { anthropicDefaultModelId } from "./anthropic.ts"
import { basetenDefaultModelId } from "./baseten.ts"
import { bedrockDefaultModelId } from "../../bedrock/index.ts"
import { deepSeekDefaultModelId } from "./deepseek.ts"
import { fireworksDefaultModelId } from "../../fireworks/index.ts"
import { geminiDefaultModelId } from "../../gemini/index.ts"
import { litellmDefaultModelId } from "../j-o/lite-llm.ts"
import { mistralDefaultModelId } from "../j-o/mistral.ts"
import { moonshotDefaultModelId } from "../j-o/moonshot.ts"
import { openAiCodexDefaultModelId } from "../../openai/codex/index.ts"
import { openRouterDefaultModelId } from "../p-u/openrouter.ts"
import { qwenCodeDefaultModelId } from "../p-u/qwen-code.ts"
import { rooDefaultModelId } from "../j-o/jabberwock.ts"
import { sambaNovaDefaultModelId } from "../p-u/sambanova.ts"
import { unboundDefaultModelId } from "../p-u/unbound.ts"
import { vertexDefaultModelId } from "../../vertex/index.ts"
import { vscodeLlmDefaultModelId } from "../v-z/vscode-llm.ts"
import { xaiDefaultModelId } from "../v-z/xai.ts"
import { vercelAiGatewayDefaultModelId } from "../v-z/vercel-ai-gateway.ts"
import { internationalZAiDefaultModelId, mainlandZAiDefaultModelId } from "../../zai/index.ts"
import { minimaxDefaultModelId } from "../j-o/minimax.ts"

import type { ProviderName } from "../../../settings/provider/categories.ts"
import { requestyDefaultModelId } from "../p-u/requesty.ts"

const STATIC_DEFAULT_MODEL_IDS: Partial<Record<ProviderName, string>> = {
	openrouter: openRouterDefaultModelId,
	requesty: requestyDefaultModelId,
	litellm: litellmDefaultModelId,
	xai: xaiDefaultModelId,
	baseten: basetenDefaultModelId,
	bedrock: bedrockDefaultModelId as string,
	vertex: vertexDefaultModelId as string,
	gemini: geminiDefaultModelId as string,
	deepseek: deepSeekDefaultModelId,
	moonshot: moonshotDefaultModelId,
	minimax: minimaxDefaultModelId,
	"openai-native": "gpt-4o",
	"openai-codex": openAiCodexDefaultModelId,
	mistral: mistralDefaultModelId,
	"vscode-lm": vscodeLlmDefaultModelId,
	sambanova: sambaNovaDefaultModelId,
	fireworks: fireworksDefaultModelId,
	jabberwock: rooDefaultModelId,
	"qwen-code": qwenCodeDefaultModelId,
	unbound: unboundDefaultModelId,
	"vercel-ai-gateway": vercelAiGatewayDefaultModelId,
}

const EMPTY_MODEL_PROVIDERS: ProviderName[] = ["openai", "ollama", "lmstudio"]

const FALLBACK_PROVIDERS: ProviderName[] = ["anthropic", "gemini-cli", "fake-ai"]

/**
 * Get the default model ID for a given provider.
 * This function returns only the provider's default model ID, without considering user configuration.
 * Used as a fallback when provider models are still loading.
 */
export function getProviderDefaultModelId(
	provider: ProviderName,
	options: { isChina?: boolean } = { isChina: false },
): string {
	if (provider === "zai") {
		return options?.isChina ? (mainlandZAiDefaultModelId as string) : (internationalZAiDefaultModelId as string)
	}

	if (EMPTY_MODEL_PROVIDERS.includes(provider)) {
		return ""
	}

	if (FALLBACK_PROVIDERS.includes(provider)) {
		return anthropicDefaultModelId
	}

	return STATIC_DEFAULT_MODEL_IDS[provider] ?? anthropicDefaultModelId
}
