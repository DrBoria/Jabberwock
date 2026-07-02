import * as path from "path"
import fs from "fs/promises"

import NodeCache from "node-cache"
import sanitize from "sanitize-filename"

import type { ModelRecord } from "@jabberwock/types"

import { getVscodeContext } from "@features/foundation/vscode/context"
import { RouterName } from "@shared/api"
import { getCacheDirectoryPath } from "@utils/io"
import { fileExistsAtPath } from "@utils/io/fs"
import { safeWriteJson } from "@utils/io"

import { getOpenRouterModelEndpoints } from "./providers/openai-compatible/openrouter"
import { getModels } from "./modelCache"

const memoryCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 5 * 60 })

const getCacheKey = (router: RouterName, modelId: string) => sanitize(`${router}_${modelId}`)

async function writeModelEndpoints(key: string, data: ModelRecord) {
	const filename = `${key}_endpoints.json`
	const cacheDir = await getCacheDirectoryPath(getVscodeContext().globalStorageUri.fsPath)
	await safeWriteJson(path.join(cacheDir, filename), data)
}

async function readModelEndpoints(key: string): Promise<ModelRecord | undefined> {
	const filename = `${key}_endpoints.json`
	const cacheDir = await getCacheDirectoryPath(getVscodeContext().globalStorageUri.fsPath)
	const filePath = path.join(cacheDir, filename)
	const exists = await fileExistsAtPath(filePath)
	return exists ? JSON.parse(await fs.readFile(filePath, "utf8")) : undefined
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
	memoryCache.set(key, modelProviders)

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
		console.error(`[jabberwock] [getModelProviders] error reading ${router} endpoints from file cache`, error)
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
	const cached = memoryCache.get<ModelRecord>(key)
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
