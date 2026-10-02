import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type { IHashmapMemory } from "@jabberwock/types"

/**
 * File-backed implementation of the hashmap memory capability (plan §4.3 — server-mode default).
 *
 * Persists a single JSON document under `<storageDir>/state/hashmap.json`. Reads are served from an
 * in-memory cache; writes update the cache and persist with atomic rename (write tmp → rename), so a
 * crash mid-write cannot corrupt the store. `keys(prefix)` supports prefix scans needed by settings/profiles.
 *
 * @param filePath - Path to the JSON document backing the store
 */
export function FileHashmapMemory(filePath: string): IHashmapMemory {
	let data: Record<string, unknown> = {}
	let loaded = false

	async function ensureLoaded(): Promise<void> {
		if (loaded) return
		try {
			const raw = await readFile(filePath, "utf-8")
			const parsed: unknown = JSON.parse(raw)
			data = isPlainObject(parsed) ? parsed : {}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				console.error("[capabilities] FileHashmapMemory failed to load, starting empty:", error)
			}
			data = {}
		}
		loaded = true
	}

	async function persist(): Promise<void> {
		await mkdir(path.dirname(filePath), { recursive: true })
		const tmpPath = `${filePath}.tmp`
		await writeFile(tmpPath, JSON.stringify(data, null, "\t"), "utf-8")
		await rename(tmpPath, filePath)
	}

	async function set(key: string, value: unknown): Promise<void> {
		await ensureLoaded()
		if (value === undefined) {
			delete data[key]
		} else {
			data[key] = value
		}
		await persist()
	}

	return {
		async get<T>(key: string): Promise<T | undefined> {
			await ensureLoaded()
			return data[key] as T | undefined
		},

		set,

		async delete(key: string): Promise<void> {
			await set(key, undefined)
		},

		async keys(prefix?: string): Promise<string[]> {
			await ensureLoaded()
			const allKeys = Object.keys(data)
			return prefix ? allKeys.filter((key) => key.startsWith(prefix)) : allKeys
		},
	}
}

/** FileHashmapMemory instance type */
export type FileHashmapMemory = IHashmapMemory

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}
