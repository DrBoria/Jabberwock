import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type { IHashmapMemory } from "@jabberwock/types"

/**
 * File-backed implementation of the hashmap memory capability (plan §4.3 — server-mode default).
 *
 * Persists a single JSON document under `<storageDir>/state/hashmap.json`. Reads are served from an
 * in-memory cache; writes update the cache and persist with atomic rename (write tmp → rename), so a
 * crash mid-write cannot corrupt the store. `keys(prefix)` supports prefix scans needed by settings/profiles.
 */
export class FileHashmapMemory implements IHashmapMemory {
	private data: Record<string, unknown> = {}
	private loaded = false

	constructor(private readonly filePath: string) {}

	private async ensureLoaded(): Promise<void> {
		if (this.loaded) return
		try {
			const raw = await readFile(this.filePath, "utf-8")
			const parsed: unknown = JSON.parse(raw)
			this.data = isPlainObject(parsed) ? parsed : {}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				console.error("[capabilities] FileHashmapMemory failed to load, starting empty:", error)
			}
			this.data = {}
		}
		this.loaded = true
	}

	private async persist(): Promise<void> {
		await mkdir(path.dirname(this.filePath), { recursive: true })
		const tmpPath = `${this.filePath}.tmp`
		await writeFile(tmpPath, JSON.stringify(this.data, null, "\t"), "utf-8")
		await rename(tmpPath, this.filePath)
	}

	async get<T>(key: string): Promise<T | undefined> {
		await this.ensureLoaded()
		return this.data[key] as T | undefined
	}

	async set(key: string, value: unknown): Promise<void> {
		await this.ensureLoaded()
		if (value === undefined) {
			delete this.data[key]
		} else {
			this.data[key] = value
		}
		await this.persist()
	}

	async delete(key: string): Promise<void> {
		await this.set(key, undefined)
	}

	async keys(prefix?: string): Promise<string[]> {
		await this.ensureLoaded()
		const allKeys = Object.keys(this.data)
		return prefix ? allKeys.filter((key) => key.startsWith(prefix)) : allKeys
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}
