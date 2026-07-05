import { z } from "zod"

import { type ModelInfo, anthropicModels } from "@jabberwock/types"

export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

export const openRouterArchitectureSchema = z.object({
	input_modalities: z.array(z.string()).nullish(),
	output_modalities: z.array(z.string()).nullish(),
	tokenizer: z.string().nullish(),
})

export const openRouterPricingSchema = z.object({
	prompt: z.string().nullish(),
	completion: z.string().nullish(),
	input_cache_write: z.string().nullish(),
	input_cache_read: z.string().nullish(),
})

export const modelRouterBaseModelSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	context_length: z.number(),
	max_completion_tokens: z.number().nullish(),
	pricing: openRouterPricingSchema.optional(),
})

export type OpenRouterBaseModel = z.infer<typeof modelRouterBaseModelSchema>

export const openRouterModelSchema = modelRouterBaseModelSchema.extend({
	id: z.string(),
	architecture: openRouterArchitectureSchema.optional(),
	top_provider: z.object({ max_completion_tokens: z.number().nullish() }).optional(),
	supported_parameters: z.array(z.string()).optional(),
})

export type OpenRouterModel = z.infer<typeof openRouterModelSchema>

export const openRouterModelEndpointSchema = modelRouterBaseModelSchema.extend({
	provider_name: z.string(),
	tag: z.string().optional(),
})

export type OpenRouterModelEndpoint = z.infer<typeof openRouterModelEndpointSchema>

export const openRouterModelsResponseSchema = z.object({
	data: z.array(openRouterModelSchema),
})

export type OpenRouterModelsResponse = z.infer<typeof openRouterModelsResponseSchema>

export const openRouterModelEndpointsResponseSchema = z.object({
	data: z.object({
		id: z.string(),
		name: z.string(),
		description: z.string().optional(),
		architecture: openRouterArchitectureSchema.optional(),
		supported_parameters: z.array(z.string()).optional(),
		endpoints: z.array(openRouterModelEndpointSchema),
	}),
})

export type OpenRouterModelEndpointsResponse = z.infer<typeof openRouterModelEndpointsResponseSchema>

export type ModelOverride = Partial<ModelInfo>

export const modelOverrides: Record<string, ModelOverride> = {
	"anthropic/claude-3.7-sonnet": {
		maxTokens: anthropicModels["claude-3-7-sonnet-20250219"].maxTokens,
		supportsReasoningBudget: false,
		supportsReasoningEffort: false,
	},
	"anthropic/claude-3.7-sonnet:thinking": {
		maxTokens: anthropicModels["claude-3-7-sonnet-20250219:thinking"].maxTokens,
	},
	"anthropic/claude-sonnet-4.6": {
		maxTokens: anthropicModels["claude-sonnet-4-6"].maxTokens,
	},
	"anthropic/claude-opus-4.1": {
		maxTokens: anthropicModels["claude-opus-4-1-20250805"].maxTokens,
	},
	"anthropic/claude-opus-4.5": {
		maxTokens: anthropicModels["claude-opus-4-5-20251101"].maxTokens,
	},
	"anthropic/claude-opus-4.6": {
		maxTokens: anthropicModels["claude-opus-4-6"].maxTokens,
	},
	"anthropic/claude-haiku-4.5": {
		supportsReasoningBudget: true,
		supportsReasoningEffort: false,
	},
	"openrouter/horizon-alpha": {
		maxTokens: 32768,
	},
	"openrouter/horizon-beta": {
		maxTokens: 32768,
	},
}

export type ParseOpenRouterModelParams = {
	id: string
	model: OpenRouterBaseModel
	inputModality: string[] | null | undefined
	outputModality: string[] | null | undefined
	maxTokens: number | null | undefined
	supportedParameters?: string[]
}

export function extractStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined
	return value.filter((v): v is string => typeof v === "string")
}
