import type { ModelRecord } from "@jabberwock/types"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import type { GetModelsOptions } from "@shared/api"

import { memoryCache, inFlightRefresh, writeModels, getModelsFromCache } from "./cache-storage"
import { fetchModelsFromProvider } from "./cache-fetcher"

export const getModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
	const { provider } = options

	let models = getModelsFromCache(provider)

	if (models) {
		return models
	}

	try {
		models = await fetchModelsFromProvider(options)
		const modelCount = Object.keys(models).length

		if (modelCount > 0) {
			memoryCache.set(provider, models)

			await writeModels(provider, models).catch((err) =>
				console.error(`[jabberwock] [MODEL_CACHE] Error writing ${provider} models to file cache:`, err),
			)
		} else {
			getTelemetryService().captureEvent(TelemetryEventName.MODEL_CACHE_EMPTY_RESPONSE, {
				provider,
				context: "getModels",
				hasExistingCache: false,
			})
		}

		return models
	} catch (error) {
		console.error(`[jabberwock] [getModels] Failed to fetch models in modelCache for ${provider}:`, error)
		throw error
	}
}

export const refreshModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
	const { provider } = options

	const existingRequest = inFlightRefresh.get(provider)
	if (existingRequest) {
		return existingRequest
	}

	const refreshPromise = (async (): Promise<ModelRecord> => {
		try {
			const models = await fetchModelsFromProvider(options)
			const modelCount = Object.keys(models).length

			const existingCache = getModelsFromCache(provider)
			const existingCount = existingCache ? Object.keys(existingCache).length : 0

			if (modelCount === 0) {
				getTelemetryService().captureEvent(TelemetryEventName.MODEL_CACHE_EMPTY_RESPONSE, {
					provider,
					context: "refreshModels",
					hasExistingCache: existingCount > 0,
					existingCacheSize: existingCount,
				})
				if (existingCount > 0) {
					return existingCache!
				}

				return {}
			}

			memoryCache.set(provider, models)

			await writeModels(provider, models).catch((err) =>
				console.error(`[jabberwock] [refreshModels] Error writing ${provider} models to disk:`, err),
			)

			return models
		} catch (error) {
			console.error(`[jabberwock] [refreshModels] Failed to refresh ${provider} models:`, error)
			return getModelsFromCache(provider) || {}
		} finally {
			inFlightRefresh.delete(provider)
		}
	})()

	inFlightRefresh.set(provider, refreshPromise)

	return refreshPromise
}

export async function initializeModelCacheRefresh(): Promise<void> {
	setTimeout(async () => {
		const publicProviders: Array<{ provider: string; options: GetModelsOptions }> = [
			{ provider: "openrouter", options: { provider: "openrouter" } },
			{ provider: "vercel-ai-gateway", options: { provider: "vercel-ai-gateway" } },
		]

		for (const { options } of publicProviders) {
			refreshModels(options).catch(() => {})

			await new Promise((resolve) => setTimeout(resolve, 500))
		}
	}, 2000)
}

export const flushModels = async (options: GetModelsOptions, refresh: boolean = false): Promise<void> => {
	const { provider } = options
	if (refresh) {
		await refreshModels(options)
	} else {
		memoryCache.del(provider)
	}
}
