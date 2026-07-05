import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@jabberwock/types"
import { VERCEL_AI_GATEWAY_VISION_ONLY_MODELS, VERCEL_AI_GATEWAY_VISION_AND_TOOLS_MODELS } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"
import { parseApiPrice } from "@shared/api/cost"

/**
 * VercelAiGatewayPricing
 */

const vercelAiGatewayPricingSchema = z.object({
	input: z.string().optional(), // Image models don't have an input price.
	output: z.string().optional(), // Embedding and image models don't have an output price.
	input_cache_write: z.string().optional(),
	input_cache_read: z.string().optional(),
	image: z.string().optional(), // Only image models have an image price.
})

/**
 * VercelAiGatewayModel
 */

const vercelAiGatewayModelSchema = z.object({
	id: z.string(),
	object: z.string(),
	created: z.number(),
	owned_by: z.string(),
	name: z.string(),
	description: z.string(),
	context_window: z.number(),
	max_tokens: z.number(),
	type: z.string(),
	pricing: vercelAiGatewayPricingSchema,
})

export type VercelAiGatewayModel = z.infer<typeof vercelAiGatewayModelSchema>

/**
 * VercelAiGatewayModelsResponse
 */

const vercelAiGatewayModelsResponseSchema = z.object({
	object: z.string(),
	data: z.array(vercelAiGatewayModelSchema),
})

function logVercelParseError(
	response: { data: unknown; headers?: Record<string, string>; status?: number },
	result: { success: false; error: { format(): unknown } },
): void {
	const contentType = response.headers?.["content-type"] ?? "unknown"
	console.error(
		"[jabberwock] Vercel AI Gateway models response is invalid. Zod error:",
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

	if (typeof contentType === "string" && contentType.includes("text/html")) {
		console.error(
			"[jabberwock] Received HTML response from Vercel AI Gateway — this usually means a proxy server intercepted the request.",
		)
	}
}

const isLanguageModel = (model: unknown): model is { id: string; type: string } & Record<string, unknown> => {
	if (typeof model !== "object" || model === null) return false
	const m = model as Record<string, unknown>
	return typeof m.id === "string" && (m.id as string).length > 0 && m.type === "language"
}

export async function getVercelAiGatewayModels(_options?: ApiHandlerOptions): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = "https://ai-gateway.vercel.sh/v1"

	try {
		const response = await axios.get<unknown>(`${baseURL}/models`, {
			headers: {
				Accept: "application/json",
			},
			proxy: false,
		})
		const result = vercelAiGatewayModelsResponseSchema.safeParse(response.data)

		if (!result.success) {
			logVercelParseError(
				{
					data: response.data,
					headers: response.headers as Record<string, string> | undefined,
					status: response.status,
				},
				result,
			)
		}

		const rawData: unknown = result.success
			? result.data.data
			: typeof response.data === "object" && response.data !== null
				? (response.data as Record<string, unknown>).data
				: undefined

		if (!Array.isArray(rawData)) {
			if (!result.success) {
				console.error(
					"[jabberwock] Vercel AI Gateway models response data is not iterable — received:",
					typeof rawData,
				)
			}
			return models
		}

		for (const model of rawData) {
			if (!isLanguageModel(model)) continue
			models[model.id] = parseVercelAiGatewayModel({ id: model.id, model: model as never })
		}
	} catch (error) {
		console.error(
			`[jabberwock] Error fetching Vercel AI Gateway models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}

function computeCacheWritePrice(pricing: VercelAiGatewayModel["pricing"]): number | undefined {
	if (pricing?.input_cache_write) {
		return parseApiPrice(pricing.input_cache_write)
	}
	return undefined
}

function computeCacheReadPrice(pricing: VercelAiGatewayModel["pricing"]): number | undefined {
	if (pricing?.input_cache_read) {
		return parseApiPrice(pricing.input_cache_read)
	}
	return undefined
}

function hasPromptCache(cacheWritesPrice: number | undefined, cacheReadsPrice: number | undefined): boolean {
	return typeof cacheWritesPrice !== "undefined" && typeof cacheReadsPrice !== "undefined"
}

function hasVisionSupport(id: string): boolean {
	return VERCEL_AI_GATEWAY_VISION_ONLY_MODELS.has(id) || VERCEL_AI_GATEWAY_VISION_AND_TOOLS_MODELS.has(id)
}

/**
 * parseVercelAiGatewayModel
 */

export const parseVercelAiGatewayModel = ({ id, model }: { id: string; model: VercelAiGatewayModel }): ModelInfo => {
	const cacheWritesPrice = computeCacheWritePrice(model.pricing)
	const cacheReadsPrice = computeCacheReadPrice(model.pricing)

	const modelInfo: ModelInfo = {
		maxTokens: model.max_tokens,
		contextWindow: model.context_window,
		supportsImages: hasVisionSupport(id),
		supportsPromptCache: hasPromptCache(cacheWritesPrice, cacheReadsPrice),
		inputPrice: parseApiPrice(model.pricing?.input),
		outputPrice: parseApiPrice(model.pricing?.output),
		cacheWritesPrice,
		cacheReadsPrice,
		description: model.description,
	}

	return modelInfo
}
