import type { IHashmapMemory, IMementoLike } from "@jabberwock/types"

/**
 * Hashmap-memory adapter over a memento-like key/value store (plan §4.3 — extension-mode default).
 *
 * In extension mode the host globalState/workspaceState mementos ARE the persistent state backend;
 * routing `hashmapMemory` through them keeps every write visible to both the legacy facade
 * (`getHostEnvironment()`) and capability consumers with zero data duplication (no split-brain store).
 * Server mode uses {@link FileHashmapMemory} instead — same interface, different backing.
 */
export function MementoBackedMemory(memento: IMementoLike): IHashmapMemory {
	return {
		async get<T>(key: string): Promise<T | undefined> {
			return memento.get<T>(key)
		},

		async set(key: string, value: unknown): Promise<void> {
			if (value === undefined) {
				await this.delete(key)
				return
			}
			await memento.update(key, value)
		},

		async delete(key: string): Promise<void> {
			const current = memento.get<unknown>(key)
			if (current !== undefined) {
				await memento.update(key, undefined)
			}
		},

		async keys(prefix?: string): Promise<string[]> {
			const all = [...memento.keys()]
			return prefix ? all.filter((k) => k.startsWith(prefix)) : all
		},
	}
}

/** MementoBackedMemory instance type */
export type MementoBackedMemory = IHashmapMemory
