import type OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"
import type { ApiHandlerOptions } from "@shared/api"

export function getUrlHost(baseUrl?: string): string {
	try {
		return new URL(baseUrl ?? "").host
	} catch (_error) {
		return ""
	}
}

export function isGrokXAI(baseUrl?: string): boolean {
	try {
		return new URL(baseUrl ?? "").host.includes("x.ai")
	} catch (_error) {
		return false
	}
}

export function isAzureAiInference(baseUrl?: string): boolean {
	try {
		return new URL(baseUrl ?? "").host.endsWith(".services.ai.azure.com")
	} catch (_error) {
		return false
	}
}

/**
 * Adds max_completion_tokens to the request body if needed based on provider configuration
 * Note: max_tokens is deprecated in favor of max_completion_tokens as per OpenAI documentation
 * O3 family models handle max_tokens separately in handleO3FamilyMessage
 */
export function addMaxTokensIfNeeded(
	options: ApiHandlerOptions,
	requestOptions:
		| OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
		| OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
	modelInfo: ModelInfo,
): void {
	// Only add max_completion_tokens if includeMaxTokens is true
	if (options.includeMaxTokens === true) {
		// Use user-configured modelMaxTokens if available, otherwise fall back to model's default maxTokens
		// Using max_completion_tokens as max_tokens is deprecated
		requestOptions.max_completion_tokens = options.modelMaxTokens || modelInfo.maxTokens
	}
}

export function isDeepseekReasoner(modelId: string, openAiR1FormatEnabled: boolean): boolean {
	return modelId.includes("deepseek-reasoner") || openAiR1FormatEnabled
}
