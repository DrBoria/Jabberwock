import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

export type BaseOpenAiCompatibleProviderOptions<ModelName extends string> = ApiHandlerOptions & {
	providerName: string
	baseURL: string
	defaultProviderModelId: ModelName
	providerModels: Record<ModelName, ModelInfo>
	defaultTemperature?: number
}

export type UsageMetrics = OpenAI.CompletionUsage & {
	prompt_tokens_details?: {
		cache_write_tokens?: number
		cached_tokens?: number
	}
}

export type ToolCallPartial = {
	type: "tool_call_partial"
	index: number
	id?: string
	name?: string
	arguments?: string
}

export type ProviderErrorResponse = {
	base_resp?: {
		status_code?: number
		status_msg?: string
	}
}
