import NodeCache from "node-cache"
import sanitize from "sanitize-filename"

import type { ModelRecord } from "@jabberwock/types"

import { RouterName } from "@shared/api"

import { getOpenRouterModelEndpoints } from "./providers/openai-compatible/openrouter"
import { getModels } from "./modelCache"
import { readJsonCacheFile, writeJsonCacheFile } from "./modelCache/storage"

const __moduleState = {
	memoryCache: new NodeCache({ stdTTL: 5 * 60, checkperiod: 5 * 60 }),
}
const getCacheKey = (router: RouterName, modelId: string) => sanitize(`${router}_${modelId}`)

async function writeModelEndpoints(key: string, data: ModelRecord) {
	await writeJsonCacheFile(`${key}_endpoints.json`, data)
}

async function readModelEndpoints(key: string): Promise<ModelRecord | undefined> {
	return readJsonCacheFile<ModelRecord>(`${key}_endpoints.json`)
}

async function copyParentCapabilities(modelProviders: ModelRecord, modelId: string): Promise<void> {
	const parentModels = await getModels({ provider: "openrouter" })
	const parentModel = parentModels[modelId]

	if (!parentModel) {
		return
	}

	for (const endpointKey of Object.keys(modelProviders)) {
		modelProviders[endpointKey].supportsReasoningEffort = parentModel.supportsReasoningEffort
		modelProviders[endpointKey].supportedParameters = parentModel.supportedParameters
			? [...parentModel.supportedParameters]
			: undefined
	}
}

async function persistModelEndpoints(key: string, modelProviders: ModelRecord): Promise<void> {
	__moduleState.memoryCache.set(key, modelProviders)

	try {
		await writeModelEndpoints(key, modelProviders)
	} catch (error) {
		console.error(`[jabberwock] [getModelProviders] error writing ${key} endpoints to file cache`, error)
	}
}

async function loadFromFileCache(router: RouterName): Promise<ModelRecord | undefined> {
	try {
		return await readModelEndpoints(router)
	} catch (error) {
		console.error(`[jabberwock] [getModelProviders] error reading ${router} endpoints from "file" cache`, error)
	}
	return undefined
}

export const getModelEndpoints = async ({
	router,
	modelId,
	endpoint,
}: {
	router: RouterName
	modelId?: string
	endpoint?: string
}): Promise<ModelRecord> => {
	if (router !== "openrouter" || !modelId || !endpoint) {
		return {}
	}

	const key = getCacheKey(router, modelId)
	const cached = __moduleState.memoryCache.get<ModelRecord>(key)
	if (cached) {
		return cached
	}

	const modelProviders = await getOpenRouterModelEndpoints(modelId)

	if (Object.keys(modelProviders).length > 0) {
		await copyParentCapabilities(modelProviders, modelId)
		await persistModelEndpoints(key, modelProviders)
		return modelProviders
	}

	return (await loadFromFileCache(router)) ?? {}
}
