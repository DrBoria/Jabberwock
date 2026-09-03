import * as path from "path"
import fs from "fs/promises"
import * as fsSync from "fs"

import NodeCache from "node-cache"
import { z } from "zod"

import type { ProviderName, ModelRecord } from "@jabberwock/types"
import { modelInfoSchema } from "@jabberwock/types"

import { safeWriteJson } from "@utils/io"

import { getHostEnvironment } from "@features/foundation/host-context/context"
import { getCacheDirectoryPath } from "@utils/io"
import type { RouterName } from "@shared/api"
import { fileExistsAtPath } from "@utils/io/fs"

const memoryCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 5 * 60 })

const modelRecordSchema = z.record(z.string(), modelInfoSchema)

const inFlightRefresh = new Map<RouterName, Promise<ModelRecord>>()

async function writeModels(router: RouterName, data: ModelRecord) {
	const filename = `${router}_models.json`
	const cacheDir = await getCacheDirectoryPath(getHostEnvironment().globalStorageUri.fsPath)
	await safeWriteJson(path.join(cacheDir, filename), data)
}

async function readModels(router: RouterName): Promise<ModelRecord | undefined> {
	const filename = `${router}_models.json`
	const cacheDir = await getCacheDirectoryPath(getHostEnvironment().globalStorageUri.fsPath)
	const filePath = path.join(cacheDir, filename)
	const exists = await fileExistsAtPath(filePath)
	return exists ? JSON.parse(await fs.readFile(filePath, "utf8")) : undefined
}

function getCacheDirectoryPathSync(): string | undefined {
	try {
		const globalStoragePath = getHostEnvironment()?.globalStorageUri?.fsPath
		if (!globalStoragePath) {
			return undefined
		}
		const cachePath = path.join(globalStoragePath, "cache")
		return cachePath
	} catch (error) {
		console.error(`[jabberwock] [MODEL_CACHE] Error getting cache directory path:`, error)
		return undefined
	}
}

export function getModelsFromCache(provider: ProviderName): ModelRecord | undefined {
	const memoryModels = memoryCache.get<ModelRecord>(provider)
	if (memoryModels) {
		return memoryModels
	}

	try {
		const filename = `${provider}_models.json`
		const cacheDir = getCacheDirectoryPathSync()
		if (!cacheDir) {
			return undefined
		}

		const filePath = path.join(cacheDir, filename)

		if (fsSync.existsSync(filePath)) {
			const data = fsSync.readFileSync(filePath, "utf8")
			const models = JSON.parse(data)

			const validation = modelRecordSchema.safeParse(models)
			if (!validation.success) {
				console.error(
					`[MODEL_CACHE] Invalid disk cache data structure for ${provider}:`,
					validation.error.format(),
				)
				return undefined
			}

			memoryCache.set(provider, validation.data)

			return validation.data
		}
	} catch (error) {
		console.error(`[jabberwock] [MODEL_CACHE] Error loading ${provider} models from disk:`, error)
	}

	return undefined
}

export { memoryCache, inFlightRefresh, writeModels, readModels }
