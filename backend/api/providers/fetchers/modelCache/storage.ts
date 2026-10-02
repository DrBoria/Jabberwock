import * as path from "path"
import fs from "fs/promises"
import * as fsSync from "fs"

import NodeCache from "node-cache"
import { z } from "zod"

import type { ProviderName, ModelRecord } from "@jabberwock/types"
import { modelInfoSchema } from "@jabberwock/types"

import { safeWriteJson } from "@utils/io"

import { getHostEnvironment } from "@features/foundation"
import { getCacheDirectoryPath } from "@utils/io"
import type { RouterName } from "@shared/api"
import { fileExistsAtPath } from "@utils/io/fs"

const __moduleState = {
	memoryCache: new NodeCache({ stdTTL: 5 * 60, checkperiod: 5 * 60 }),
}
const modelRecordSchema = z.record(z.string(), modelInfoSchema)

const inFlightRefresh = new Map<RouterName, Promise<ModelRecord>>()

/**
 * Write a JSON cache file into the global cache directory.
 * Shared canonical implementation for all provider file caches
 * (models, endpoints, ...).
 */
export async function writeJsonCacheFile(filename: string, data: unknown): Promise<void> {
	const cacheDir = await getCacheDirectoryPath(getHostEnvironment().globalStorageUri.fsPath)
	await safeWriteJson(path.join(cacheDir, filename), data)
}

/**
 * Read a JSON cache file from the global cache directory.
 * Returns undefined when the file does not exist.
 */
export async function readJsonCacheFile<T>(filename: string): Promise<T | undefined> {
	const cacheDir = await getCacheDirectoryPath(getHostEnvironment().globalStorageUri.fsPath)
	const filePath = path.join(cacheDir, filename)
	const exists = await fileExistsAtPath(filePath)
	return exists ? (JSON.parse(await fs.readFile(filePath, "utf8")) as T) : undefined
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
	const memoryModels = __moduleState.memoryCache.get<ModelRecord>(provider)
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

			__moduleState.memoryCache.set(provider, validation.data)

			return validation.data
		}
	} catch (error) {
		console.error(`[jabberwock] [MODEL_CACHE] Error loading ${provider} models from disk:`, error)
	}

	return undefined
}

export const { memoryCache } = __moduleState
export { inFlightRefresh }
