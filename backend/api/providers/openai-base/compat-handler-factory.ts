import type { ModelInfo } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-provider-core"

/**
 * Canonical factory for thin OpenAI-compatible provider handlers.
 *
 * Providers that differ only by static config (name, base URL, key, model
 * catalog) delegate here instead of repeating the same wrapper body.
 */
export function createOpenAiCompatibleHandler(
	options: ApiHandlerOptions,
	config: {
		providerName: string
		baseURL: string
		apiKey?: string
		defaultProviderModelId: string
		providerModels: Record<string, ModelInfo>
		defaultTemperature?: number
	},
) {
	const base = BaseOpenAiCompatibleProvider({
		...options,
		...config,
	})
	const handler = { ...base }
	return handler
}
