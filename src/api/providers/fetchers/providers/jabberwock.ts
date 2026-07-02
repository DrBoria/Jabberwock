import { RooModelsResponseSchema, type ModelInfo, type ModelRecord } from "@jabberwock/types"

import { parseApiPrice } from "@shared/api/cost"

import { DEFAULT_HEADERS } from "@api/providers/constants"
import { resolveVersionedSettings, type VersionedSettings } from "@api/providers/fetchers/versionedSettings"

/**
 * Fetches available models from the Jabberwock Cloud provider
 *
 * @param baseUrl The base URL of the Jabberwock Cloud provider
 * @param apiKey The API key (session token) for the Jabberwock Cloud provider
 * @returns A promise that resolves to a record of model IDs to model info
 * @throws Will throw an error if the request fails or the response is not as expected.
 */
function parseRooModel(model: {
	id: string
	tags?: string[]
	pricing: { input: string; output: string; input_cache_read?: string; input_cache_write?: string }
	context_window: number
	max_tokens: number
	description?: string
	name?: string
	deprecated?: boolean
	default_temperature?: number
	settings?: Record<string, unknown>
	versionedSettings?: VersionedSettings
}): ModelInfo {
	const modelId = model.id
	const tags = model.tags || []
	const pricing = model.pricing

	const supportsImages = tags.includes("vision")
	const supportsReasoningEffort = tags.includes("reasoning")
	const requiredReasoningEffort = tags.includes("reasoning-required")
	const isStealthModel = tags.includes("stealth")

	const inputPrice = parseApiPrice(pricing.input)
	const outputPrice = parseApiPrice(pricing.output)
	const cacheReadPrice = pricing.input_cache_read ? parseApiPrice(pricing.input_cache_read) : undefined
	const cacheWritePrice = pricing.input_cache_write ? parseApiPrice(pricing.input_cache_write) : undefined

	const baseModelInfo = {
		maxTokens: model.max_tokens,
		contextWindow: model.context_window,
		supportsImages,
		supportsReasoningEffort,
		requiredReasoningEffort,
		supportsPromptCache: Boolean(cacheReadPrice !== undefined),
		inputPrice,
		outputPrice,
		cacheWritesPrice: cacheWritePrice,
		cacheReadsPrice: cacheReadPrice,
		description: model.description || model.name || modelId,
		deprecated: model.deprecated || false,
		isFree: tags.includes("free"),
		defaultTemperature: model.default_temperature,
		isStealthModel: isStealthModel || undefined,
	}

	const apiSettings = model.settings as Record<string, unknown> | undefined
	const apiVersionedSettings = model.versionedSettings as VersionedSettings | undefined

	return resolveModelSettings(baseModelInfo, apiSettings, apiVersionedSettings)
}

function resolveModelSettings(
	baseModelInfo: ModelInfo,
	apiSettings: Record<string, unknown> | undefined,
	apiVersionedSettings: VersionedSettings | undefined,
): ModelInfo {
	if (!apiVersionedSettings && !apiSettings) {
		return baseModelInfo
	}

	if (apiVersionedSettings) {
		const resolvedVersionedSettings = resolveVersionedSettings<Partial<ModelInfo>>(apiVersionedSettings)
		if (Object.keys(resolvedVersionedSettings).length > 0) {
			return { ...baseModelInfo, ...resolvedVersionedSettings }
		}
		if (apiSettings) {
			return { ...baseModelInfo, ...(apiSettings as Partial<ModelInfo>) }
		}
		return baseModelInfo
	}

	return { ...baseModelInfo, ...(apiSettings as Partial<ModelInfo>) }
}

function handleFetchError(error: unknown, url: string, apiKey?: string): never | ModelRecord {
	const err = error instanceof Error ? error : new Error(String(error))

	if (err.name === "AbortError" || err instanceof TypeError) {
		console.debug("[getRooModels] Jabberwock Cloud is unreachable, returning empty models:", {
			message: err.message || String(err),
			name: err.name,
			url,
		})
		return {}
	}

	console.error("[jabberwock] [getRooModels] Error fetching Jabberwock Cloud models:", {
		message: err.message || String(err),
		name: err.name,
		stack: err.stack,
		url,
		hasApiKey: Boolean(apiKey),
	})

	if (err.message?.includes("HTTP")) {
		throw new Error(`Failed to fetch Jabberwock Cloud models: ${err.message}. Check base URL and API key.`)
	}

	throw new Error(`Failed to fetch Jabberwock Cloud models: ${err.message || "An unknown error occurred."}`)
}

function buildFetchHeaders(apiKey?: string): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...DEFAULT_HEADERS,
	}

	if (apiKey) {
		headers["Authorization"] = `Bearer ${apiKey}`
	}

	return headers
}

async function handleHttpError(response: Response, url: string): Promise<never> {
	let errorBody = ""
	try {
		errorBody = await response.text()
	} catch {
		errorBody = "(unable to read response body)"
	}

	console.error(`[jabberwock] [getRooModels] HTTP error:`, {
		status: response.status,
		statusText: response.statusText,
		url,
		body: errorBody,
	})

	throw new Error(`HTTP ${response.status}: ${response.statusText}`)
}

export async function getRooModels(baseUrl: string, apiKey?: string): Promise<ModelRecord> {
	const normalizedBase = baseUrl.replace(/\/?v1\/?$/, "")
	const url = `${normalizedBase}/v1/models`

	try {
		const headers = buildFetchHeaders(apiKey)

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 10000)

		try {
			const response = await fetch(url, {
				headers,
				signal: controller.signal,
			})

			if (!response.ok) {
				await handleHttpError(response, url)
			}

			const data = await response.json()
			const parsed = RooModelsResponseSchema.safeParse(data)

			if (!parsed.success) {
				console.error("[jabberwock] Error fetching Jabberwock Cloud models: Unexpected response format", data)
				console.error("[jabberwock] Validation errors:", parsed.error.format())
				throw new Error("Failed to fetch Jabberwock Cloud models: Unexpected response format.")
			}

			const models: ModelRecord = {}

			for (const model of parsed.data.data) {
				if (!model.id) continue
				models[model.id] = parseRooModel(model as Parameters<typeof parseRooModel>[0])
			}

			return models
		} finally {
			clearTimeout(timeoutId)
		}
	} catch (error) {
		return handleFetchError(error, url, apiKey)
	}
}
