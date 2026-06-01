import axios from "axios"
import { z } from "zod"

import {
	type ModelInfo,
	isModelParameter,
	OPEN_ROUTER_REASONING_BUDGET_MODELS,
	OPEN_ROUTER_REQUIRED_REASONING_BUDGET_MODELS,
	anthropicModels,
} from "@jabberwock/types"

import type { ApiHandlerOptions } from "../../../shared/api"
import { parseApiPrice } from "../../../shared/cost"

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * OpenRouterBaseModel
 */

const openRouterArchitectureSchema = z.object({
	input_modalities: z.array(z.string()).nullish(),
	output_modalities: z.array(z.string()).nullish(),
	tokenizer: z.string().nullish(),
})

const openRouterPricingSchema = z.object({
	prompt: z.string().nullish(),
	completion: z.string().nullish(),
	input_cache_write: z.string().nullish(),
	input_cache_read: z.string().nullish(),
})

const modelRouterBaseModelSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	context_length: z.number(),
	max_completion_tokens: z.number().nullish(),
	pricing: openRouterPricingSchema.optional(),
})

export type OpenRouterBaseModel = z.infer<typeof modelRouterBaseModelSchema>

/**
 * OpenRouterModel
 */

export const openRouterModelSchema = modelRouterBaseModelSchema.extend({
	id: z.string(),
	architecture: openRouterArchitectureSchema.optional(),
	top_provider: z.object({ max_completion_tokens: z.number().nullish() }).optional(),
	supported_parameters: z.array(z.string()).optional(),
})

export type OpenRouterModel = z.infer<typeof openRouterModelSchema>

/**
 * OpenRouterModelEndpoint
 */

export const openRouterModelEndpointSchema = modelRouterBaseModelSchema.extend({
	provider_name: z.string(),
	tag: z.string().optional(),
})

export type OpenRouterModelEndpoint = z.infer<typeof openRouterModelEndpointSchema>

/**
 * OpenRouterModelsResponse
 */

const openRouterModelsResponseSchema = z.object({
	data: z.array(openRouterModelSchema),
})

type OpenRouterModelsResponse = z.infer<typeof openRouterModelsResponseSchema>

/**
 * OpenRouterModelEndpointsResponse
 */

const openRouterModelEndpointsResponseSchema = z.object({
	data: z.object({
		id: z.string(),
		name: z.string(),
		description: z.string().optional(),
		architecture: openRouterArchitectureSchema.optional(),
		supported_parameters: z.array(z.string()).optional(),
		endpoints: z.array(openRouterModelEndpointSchema),
	}),
})

type OpenRouterModelEndpointsResponse = z.infer<typeof openRouterModelEndpointsResponseSchema>

/**
 * getOpenRouterModels
 */

export async function getOpenRouterModels(options?: ApiHandlerOptions): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = options?.openRouterBaseUrl || "https://openrouter.ai/api/v1"

	try {
		const response = await axios.get<unknown>(`${baseURL}/models`, {
			headers: {
				Accept: "application/json",
				"User-Agent": "Jabberwock/1.0",
			},
			// Bypass any global proxy configuration for this request.
			// The OpenRouter API must be called directly — proxy is only intended
			// for LLM inference traffic, not for model/metadata discovery.
			proxy: false,
		})
		const result = openRouterModelsResponseSchema.safeParse(response.data)

		if (!result.success) {
			const contentType = response.headers?.["content-type"] ?? "unknown"
			console.error(
				"[jabberwock] OpenRouter models response is invalid. Zod error:",
				result.error.format(),
				"\n  HTTP status:",
				response.status,
				"\n  Content-Type:",
				contentType,
				"\n  Response body:",
				typeof response.data === "object"
					? JSON.stringify(response.data).slice(0, 500)
					: String(response.data).slice(0, 500),
			)

			// If we got an HTML response, the request likely went through a proxy/gateway.
			// Log a clear hint for the user.
			if (typeof contentType === "string" && contentType.includes("text/html")) {
				console.error(
					"[jabberwock] Received HTML response from OpenRouter API — this usually means a proxy server intercepted the request.",
				)
			}
		}

		// Safely extract data array — the API may return an error response instead of { data: [...] }
		const rawData: unknown = result.success
			? result.data.data
			: isRecord(response.data)
				? response.data.data
				: undefined

		if (!Array.isArray(rawData)) {
			if (!result.success) {
				console.error("[jabberwock] OpenRouter models response data is not an array, got:", typeof rawData)
			}
			return models
		}

		for (const model of rawData) {
			if (!isRecord(model)) continue
			const parsed = modelRouterBaseModelSchema.safeParse(model)
			if (!parsed.success) continue
			const modelId = String(model.id ?? "")
			const architecture = isRecord(model.architecture) ? model.architecture : undefined
			const topProvider = isRecord(model.top_provider) ? model.top_provider : undefined
			models[modelId] = parseOpenRouterModel({
				id: modelId,
				model: parsed.data,
				inputModality: Array.isArray(architecture?.input_modalities)
					? architecture.input_modalities.filter((v): v is string => typeof v === "string")
					: undefined,
				outputModality: Array.isArray(architecture?.output_modalities)
					? architecture.output_modalities.filter((v): v is string => typeof v === "string")
					: undefined,
				maxTokens:
					typeof topProvider?.max_completion_tokens === "number"
						? topProvider.max_completion_tokens
						: undefined,
				supportedParameters: Array.isArray(model.supported_parameters)
					? model.supported_parameters.filter((p): p is string => typeof p === "string")
					: undefined,
			})
		}
	} catch (error) {
		console.error(
			`[jabberwock] Error fetching OpenRouter models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}

/**
 * getOpenRouterModelEndpoints
 */

export async function getOpenRouterModelEndpoints(
	modelId: string,
	options?: ApiHandlerOptions,
): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = options?.openRouterBaseUrl || "https://openrouter.ai/api/v1"

	try {
		const response = await axios.get<unknown>(`${baseURL}/models/${modelId}/endpoints`, {
			headers: {
				Accept: "application/json",
				"User-Agent": "Jabberwock/1.0",
			},
			// Bypass any global proxy configuration for this request.
			// The OpenRouter API must be called directly — proxy is only intended
			// for LLM inference traffic, not for model/metadata discovery.
			proxy: false,
		})
		const result = openRouterModelEndpointsResponseSchema.safeParse(response.data)

		if (!result.success) {
			const contentType = response.headers?.["content-type"] ?? "unknown"
			const responseBody = typeof response.data === "string" ? response.data : JSON.stringify(response.data)
			console.error(
				"[jabberwock] OpenRouter model endpoints response is invalid.",
				responseBody.slice(0, 200),
				"\n  Zod error:",
				result.error.format(),
				"\n  HTTP status:",
				response.status,
				"\n  Content-Type:",
				contentType,
			)

			if (typeof contentType === "string" && contentType.includes("text/html")) {
				console.error(
					"[jabberwock] Received HTML response from OpenRouter API — this usually means a proxy server intercepted the request.",
				)
			}

			return models
		}

		const data = result.data.data
		const { id, architecture, endpoints } = data

		// Skip image generation models (models that output images)
		if (architecture?.output_modalities?.includes("image")) {
			return models
		}

		for (const endpoint of endpoints) {
			models[endpoint.tag ?? endpoint.provider_name] = parseOpenRouterModel({
				id,
				model: endpoint,
				inputModality: architecture?.input_modalities,
				outputModality: architecture?.output_modalities,
				maxTokens: endpoint.max_completion_tokens,
			})
		}
	} catch (error) {
		console.error(
			`[jabberwock] Error fetching OpenRouter model endpoints: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}

/**
 * parseOpenRouterModel
 */

export const parseOpenRouterModel = ({
	id,
	model,
	inputModality,
	outputModality,
	maxTokens,
	supportedParameters,
}: {
	id: string
	model: OpenRouterBaseModel
	inputModality: string[] | null | undefined
	outputModality: string[] | null | undefined
	maxTokens: number | null | undefined
	supportedParameters?: string[]
}): ModelInfo => {
	const cacheWritesPrice = model.pricing?.input_cache_write
		? parseApiPrice(model.pricing?.input_cache_write)
		: undefined

	const cacheReadsPrice = model.pricing?.input_cache_read ? parseApiPrice(model.pricing?.input_cache_read) : undefined

	const supportsPromptCache = typeof cacheReadsPrice !== "undefined" // some models support caching but don't charge a cacheWritesPrice, e.g. GPT-5

	const modelInfo: ModelInfo = {
		maxTokens: maxTokens || Math.ceil(model.context_length * 0.2),
		contextWindow: model.context_length,
		supportsImages: inputModality?.includes("image") ?? false,
		supportsPromptCache,
		inputPrice: parseApiPrice(model.pricing?.prompt ?? undefined),
		outputPrice: parseApiPrice(model.pricing?.completion ?? undefined),
		cacheWritesPrice,
		cacheReadsPrice,
		description: model.description,
		supportsReasoningEffort: supportedParameters ? supportedParameters.includes("reasoning") : undefined,
		supportedParameters: supportedParameters ? supportedParameters.filter(isModelParameter) : undefined,
	}

	if (OPEN_ROUTER_REASONING_BUDGET_MODELS.has(id)) {
		modelInfo.supportsReasoningBudget = true
	}

	if (OPEN_ROUTER_REQUIRED_REASONING_BUDGET_MODELS.has(id)) {
		modelInfo.requiredReasoningBudget = true
	}

	// For backwards compatibility with the old model definitions we will
	// continue to disable extending thinking for anthropic/claude-3.7-sonnet
	// and force it for anthropic/claude-3.7-sonnet:thinking.

	if (id === "anthropic/claude-3.7-sonnet") {
		modelInfo.maxTokens = anthropicModels["claude-3-7-sonnet-20250219"].maxTokens
		modelInfo.supportsReasoningBudget = false
		modelInfo.supportsReasoningEffort = false
	}

	if (id === "anthropic/claude-3.7-sonnet:thinking") {
		modelInfo.maxTokens = anthropicModels["claude-3-7-sonnet-20250219:thinking"].maxTokens
	}

	// Set claude-sonnet-4.6 model to use the correct configuration
	if (id === "anthropic/claude-sonnet-4.6") {
		modelInfo.maxTokens = anthropicModels["claude-sonnet-4-6"].maxTokens
	}

	// Set claude-opus-4.1 model to use the correct configuration
	if (id === "anthropic/claude-opus-4.1") {
		modelInfo.maxTokens = anthropicModels["claude-opus-4-1-20250805"].maxTokens
	}

	// Set claude-opus-4.5 model to use the correct configuration
	if (id === "anthropic/claude-opus-4.5") {
		modelInfo.maxTokens = anthropicModels["claude-opus-4-5-20251101"].maxTokens
	}

	// Set claude-opus-4.6 model to use the correct configuration
	if (id === "anthropic/claude-opus-4.6") {
		modelInfo.maxTokens = anthropicModels["claude-opus-4-6"].maxTokens
	}

	// Ensure correct reasoning handling for Claude Haiku 4.5 on OpenRouter
	// Use budget control and disable effort-based reasoning fallback
	if (id === "anthropic/claude-haiku-4.5") {
		modelInfo.supportsReasoningBudget = true
		modelInfo.supportsReasoningEffort = false
	}

	// Set horizon-alpha model to 32k max tokens
	if (id === "openrouter/horizon-alpha") {
		modelInfo.maxTokens = 32768
	}

	// Set horizon-beta model to 32k max tokens
	if (id === "openrouter/horizon-beta") {
		modelInfo.maxTokens = 32768
	}

	return modelInfo
}
