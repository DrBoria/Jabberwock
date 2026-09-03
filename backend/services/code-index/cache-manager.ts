import * as path from "path"
import { promises as fsp } from "fs"

import { createHash } from "crypto"
import type { IExtensionContextView } from "@features/foundation/host-context/context"
import { ICacheManager } from "./interfaces/cache"
import debounce from "lodash.debounce"
import { safeWriteJson } from "@utils/io"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"

/**
 * Manages the cache for code indexing
 */
export class CacheManager implements ICacheManager {
	/** v4 B2 (L5): plain path — node:fs replaces workspace.fs; the storage root comes from the structural context view. */
	private cachePath: string
	private fileHashes: Record<string, string> = {}
	private _debouncedSaveCache: () => void

	/**
	 * Creates a new cache manager
	 * @param context VS Code extension context
	 * @param workspacePath Path to the workspace
	 */
	constructor(
		private context: IExtensionContextView,
		private workspacePath: string,
	) {
		// v4 B2 (L3/L5): the structural view exposes only fsPath — build the cache URI from an absolute path instead of Uri.joinPath on a host Uri. Resulting path is identical to before in extension mode.
		const fileName = `jabberwock-index-cache-${createHash("sha256").update(workspacePath).digest("hex")}.json`
		this.cachePath = path.join(context.globalStorageUri.fsPath, fileName)
		this._debouncedSaveCache = debounce(async () => {
			await this._performSave()
		}, 1500)
	}

	/**
	 * Initializes the cache manager by loading the cache file
	 */
	async initialize(): Promise<void> {
		try {
			// v4 B2 (L5): node:fs — identical bytes to workspace.fs.readFile for file:// paths.
			const cacheData = await fsp.readFile(this.cachePath, "utf-8")
			this.fileHashes = JSON.parse(cacheData)
		} catch (error) {
			this.fileHashes = {}
			getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "initialize",
			})
		}
	}

	/**
	 * Saves the cache to disk
	 */
	private async _performSave(): Promise<void> {
		try {
			await safeWriteJson(this.cachePath, this.fileHashes)
		} catch (error) {
			console.error("[jabberwock] Failed to save cache:", error)
			getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "_performSave",
			})
		}
	}

	/**
	 * Clears the cache file by writing an empty object to it
	 */
	async clearCacheFile(): Promise<void> {
		try {
			await safeWriteJson(this.cachePath, {})
			this.fileHashes = {}
		} catch (error) {
			console.error("[jabberwock] Failed to clear cache file:", error, this.cachePath)
			getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "clearCacheFile",
			})
		}
	}

	/**
	 * Gets the hash for a file path
	 * @param filePath Path to the file
	 * @returns The hash for the file or undefined if not found
	 */
	getHash(filePath: string): string | undefined {
		return this.fileHashes[filePath]
	}

	/**
	 * Updates the hash for a file path
	 * @param filePath Path to the file
	 * @param hash New hash value
	 */
	updateHash(filePath: string, hash: string): void {
		this.fileHashes[filePath] = hash
		this._debouncedSaveCache()
	}

	/**
	 * Deletes the hash for a file path
	 * @param filePath Path to the file
	 */
	deleteHash(filePath: string): void {
		delete this.fileHashes[filePath]
		this._debouncedSaveCache()
	}

	/**
	 * Flushes any pending debounced cache writes to disk immediately.
	 */
	async flush(): Promise<void> {
		await this._performSave()
	}

	/**
	 * Gets a copy of all file hashes
	 * @returns A copy of the file hashes record
	 */
	getAllHashes(): Record<string, string> {
		return { ...this.fileHashes }
	}
}
