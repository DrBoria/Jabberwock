import type { SafeParseReturnType } from "zod"

import { parseApiPrice } from "@shared/api/cost"
import {
	type ModelInfo,
	type ModelParameter,
	isModelParameter,
	OPEN_ROUTER_REASONING_BUDGET_MODELS,
	OPEN_ROUTER_REQUIRED_REASONING_BUDGET_MODELS,
} from "@jabberwock/types"

import {
	isRecord,
	type OpenRouterBaseModel,
	type OpenRouterModelsResponse,
	modelOverrides,
	modelRouterBaseModelSchema,
	extractStringArray,
} from "./openrouter-schemas"

export function logOpenRouterParseError(
	response: { data: unknown; headers?: Record<string, string | string[] | undefined>; status?: number },
	result: { success: false; error: { format(): unknown } },
): void {
	const contentType = response.headers?.["content-type"]
	const contentTypeStr = Array.isArray(contentType) ? contentType.join(", ") : (contentType ?? "unknown")
	console.error(
		"[jabberwock] OpenRouter models response is invalid. Zod error:",
		result.error.format(),
		"\n  HTTP status:",
		response.status,
		"\n  Content-Type:",
		contentTypeStr,
		"\n  Response body:",
		typeof response.data === "object"
			? JSON.stringify(response.data).slice(0, 500)
			: String(response.data).slice(0, 500),
	)

	if (typeof contentTypeStr === "string" && contentTypeStr.includes("text/html")) {
		console.error(
			"[jabberwock] Received HTML response from OpenRouter API — this usually means a proxy server intercepted the request.",
		)
	}
}

export function extractModelFromRaw(model: unknown): {
	id: string
	baseModel: OpenRouterBaseModel | undefined
	inputModality: string[] | undefined
	outputModality: string[] | undefined
	maxTokens: number | undefined
	supportedParameters: string[] | undefined
} | null {
	if (!isRecord(model)) return null
	const parsed = modelRouterBaseModelSchema.safeParse(model)
	if (!parsed.success) return null
	const architecture = isRecord(model.architecture) ? model.architecture : undefined
	const topProvider = isRecord(model.top_provider) ? model.top_provider : undefined
	const maxTokens =
		typeof topProvider?.max_completion_tokens === "number" ? topProvider.max_completion_tokens : undefined
	return {
		id: String(model.id ?? ""),
		baseModel: parsed.data,
		inputModality: extractStringArray(architecture?.input_modalities),
		outputModality: extractStringArray(architecture?.output_modalities),
		maxTokens,
		supportedParameters: extractStringArray(model.supported_parameters),
	}
}

export function extractRawDataFromResponse(
	response: { data: unknown },
	result: SafeParseReturnType<unknown, OpenRouterModelsResponse>,
): unknown {
	if (result.success) return result.data.data
	if (isRecord(response.data)) return (response.data as Record<string, unknown>).data
	return undefined
}

export function logInvalidResponse(rawData: unknown, result: { success: boolean }): void {
	if (!result.success) {
		console.error("[jabberwock] OpenRouter models response data is not an array, got:", typeof rawData)
	}
}

export function logEndpointsParseError(
	response: { data: unknown; headers?: Record<string, string | string[] | undefined>; status?: number },
	result: { success: false; error: { format(): unknown } },
): void {
	const contentType = response.headers?.["content-type"]
	const contentTypeStr = Array.isArray(contentType) ? contentType.join(", ") : (contentType ?? "unknown")
	const responseBody = typeof response.data === "string" ? response.data : JSON.stringify(response.data)
	console.error(
		"[jabberwock] OpenRouter model endpoints response is invalid.",
		responseBody.slice(0, 200),
		"\n  Zod error:",
		result.error.format(),
		"\n  HTTP status:",
		response.status,
		"\n  Content-Type:",
		contentTypeStr,
	)

	if (typeof contentTypeStr === "string" && contentTypeStr.includes("text/html")) {
		console.error(
			"[jabberwock] Received HTML response from OpenRouter API — this usually means a proxy server intercepted the request.",
		)
	}
}

export function computeCacheWritePrice(pricing: OpenRouterBaseModel["pricing"]): number | undefined {
	if (pricing?.input_cache_write) {
		return parseApiPrice(pricing.input_cache_write)
	}
	return undefined
}

export function computeCacheReadPrice(pricing: OpenRouterBaseModel["pricing"]): number | undefined {
	if (pricing?.input_cache_read) {
		return parseApiPrice(pricing.input_cache_read)
	}
	return undefined
}

export function computeReasoningFields(supportedParameters: string[] | undefined): {
	supportsReasoningEffort: boolean | undefined
	supportedParameters: ModelParameter[] | undefined
} {
	if (!supportedParameters) return { supportsReasoningEffort: undefined, supportedParameters: undefined }
	return {
		supportsReasoningEffort: supportedParameters.includes("reasoning"),
		supportedParameters: supportedParameters.filter(isModelParameter),
	}
}

export function applyOpenRouterModelOverrides(id: string, modelInfo: ModelInfo): void {
	if (OPEN_ROUTER_REASONING_BUDGET_MODELS.has(id)) {
		modelInfo.supportsReasoningBudget = true
	}
	if (OPEN_ROUTER_REQUIRED_REASONING_BUDGET_MODELS.has(id)) {
		modelInfo.requiredReasoningBudget = true
	}
	const override = modelOverrides[id]
	if (override) {
		Object.assign(modelInfo, override)
	}
}
