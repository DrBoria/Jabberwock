import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@jabberwock/types"
import { VERCEL_AI_GATEWAY_VISION_ONLY_MODELS, VERCEL_AI_GATEWAY_VISION_AND_TOOLS_MODELS } from "@jabberwock/types"

import type { ApiHandlerOptions } from "../../../shared/api"
import { parseApiPrice } from "../../../shared/cost"

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

type VercelAiGatewayModelsResponse = z.infer<typeof vercelAiGatewayModelsResponseSchema>

/**
 * getVercelAiGatewayModels
 */

export async function getVercelAiGatewayModels(options?: ApiHandlerOptions): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = "https://ai-gateway.vercel.sh/v1"

	try {
		const response = await axios.get<unknown>(`${baseURL}/models`, {
			headers: {
				Accept: "application/json",
			},
			// Bypass any global proxy configuration for this request.
			// The Vercel AI Gateway API must be called directly — proxy is only intended
			// for LLM inference traffic, not for model/metadata discovery.
			proxy: false,
		})
		const result = vercelAiGatewayModelsResponseSchema.safeParse(response.data)

		if (!result.success) {
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

			// If we got an HTML response, the request likely went through a proxy/gateway.
			if (typeof contentType === "string" && contentType.includes("text/html")) {
				console.error(
					"[jabberwock] Received HTML response from Vercel AI Gateway — this usually means a proxy server intercepted the request.",
				)
			}
		}

		// Safely extract data array — API may return error or non-JSON response
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
			if (typeof model !== "object" || model === null) continue
			const { id } = model as Record<string, unknown>
			if (typeof id !== "string" || id.length === 0) continue

			// Only include language models for chat inference.
			// Embedding models are statically defined in embeddingModels.ts.
			if (model.type !== "language") {
				continue
			}

			models[id] = parseVercelAiGatewayModel({ id, model })
		}
	} catch (error) {
		console.error(
			`[jabberwock] Error fetching Vercel AI Gateway models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}

/**
 * parseVercelAiGatewayModel
 */

export const parseVercelAiGatewayModel = ({ id, model }: { id: string; model: VercelAiGatewayModel }): ModelInfo => {
	const cacheWritesPrice = model.pricing?.input_cache_write
		? parseApiPrice(model.pricing?.input_cache_write)
		: undefined

	const cacheReadsPrice = model.pricing?.input_cache_read ? parseApiPrice(model.pricing?.input_cache_read) : undefined

	const supportsPromptCache = typeof cacheWritesPrice !== "undefined" && typeof cacheReadsPrice !== "undefined"
	const supportsImages =
		VERCEL_AI_GATEWAY_VISION_ONLY_MODELS.has(id) || VERCEL_AI_GATEWAY_VISION_AND_TOOLS_MODELS.has(id)

	const modelInfo: ModelInfo = {
		maxTokens: model.max_tokens,
		contextWindow: model.context_window,
		supportsImages,
		supportsPromptCache,
		inputPrice: parseApiPrice(model.pricing?.input),
		outputPrice: parseApiPrice(model.pricing?.output),
		cacheWritesPrice,
		cacheReadsPrice,
		description: model.description,
	}

	return modelInfo
}
