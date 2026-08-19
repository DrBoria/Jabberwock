import { ProviderName } from "./categories.ts"

/**
 * ANTHROPIC_STYLE_PROVIDERS
 */

// Providers that use Anthropic-style API protocol.
export const ANTHROPIC_STYLE_PROVIDERS: ProviderName[] = ["anthropic", "bedrock", "minimax"]

const GATEWAY_ANTHROPIC_PROVIDERS: ProviderName[] = ["vercel-ai-gateway", "jabberwock"]

function isAnthropicStyleProvider(provider: ProviderName | undefined): boolean {
	if (!provider) {
		return false
	}
	return ANTHROPIC_STYLE_PROVIDERS.includes(provider)
}

function isVertexClaudeModel(provider: ProviderName | undefined, modelId?: string): boolean {
	if (provider !== "vertex") {
		return false
	}
	if (!modelId) {
		return false
	}
	return modelId.toLowerCase().includes("claude")
}

function isGatewayAnthropicModel(provider: ProviderName | undefined, modelId?: string): boolean {
	if (!provider) {
		return false
	}
	if (!GATEWAY_ANTHROPIC_PROVIDERS.includes(provider)) {
		return false
	}
	if (!modelId) {
		return false
	}
	return modelId.toLowerCase().startsWith("anthropic/")
}

export const getApiProtocol = (provider: ProviderName | undefined, modelId?: string): "anthropic" | "openai" => {
	if (isAnthropicStyleProvider(provider)) {
		return "anthropic"
	}
	if (isVertexClaudeModel(provider, modelId)) {
		return "anthropic"
	}
	if (isGatewayAnthropicModel(provider, modelId)) {
		return "anthropic"
	}
	return "openai"
}
