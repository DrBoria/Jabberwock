import * as path from "path"
import { promises as fsp } from "fs"

import { createHash } from "crypto"
import type { IExtensionContextView } from "@features/foundation/host-context/context"
import debounce from "lodash.debounce"
import { safeWriteJson } from "@utils/io"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"

/**
 * Manages the cache for code indexing
 */
export function CacheManager(context: IExtensionContextView, workspacePath: string) {
	// v4 B2 (L3/L5): the structural view exposes only fsPath — build the cache URI from "an" absolute path instead of Uri.joinPath on a host Uri. Resulting path is identical to before in extension mode.
	const fileName = `jabberwock-index-cache-${createHash("sha256").update(workspacePath).digest("hex")}.json`
	const cachePath = path.join(context.globalStorageUri.fsPath, fileName)
	const _debouncedSaveCache = debounce(async () => {
		await handler._performSave()
	}, 1500)

	const handler = {
		cachePath: cachePath,
		fileHashes: {} as Record<string, string>,
		_debouncedSaveCache: _debouncedSaveCache,
		context,
		workspacePath,
		async initialize(): Promise<void> {
			try {
				// v4 B2 (L5): node:fs — identical bytes to workspace.fs.readFile for file:// paths.
				const cacheData = await fsp.readFile(handler.cachePath, "utf-8")
				handler.fileHashes = JSON.parse(cacheData)
			} catch (error) {
				handler.fileHashes = {}
				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "initialize",
				})
			}
		},
		async _performSave(): Promise<void> {
			try {
				await safeWriteJson(handler.cachePath, handler.fileHashes)
			} catch (error) {
				console.error("[jabberwock] Failed to save cache:", error)
				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "_performSave",
				})
			}
		},
		async clearCacheFile(): Promise<void> {
			try {
				await safeWriteJson(handler.cachePath, {})
				handler.fileHashes = {}
			} catch (error) {
				console.error("[jabberwock] Failed to clear cache file:", error, handler.cachePath)
				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "clearCacheFile",
				})
			}
		},
		getHash(filePath: string): string | undefined {
			return handler.fileHashes[filePath]
		},
		updateHash(filePath: string, hash: string): void {
			handler.fileHashes[filePath] = hash
			handler._debouncedSaveCache()
		},
		deleteHash(filePath: string): void {
			delete handler.fileHashes[filePath]
			handler._debouncedSaveCache()
		},
		async flush(): Promise<void> {
			await handler._performSave()
		},
		getAllHashes(): Record<string, string> {
			return { ...handler.fileHashes }
		},
	}
	return handler
}
export type CacheManager = ReturnType<typeof CacheManager>
