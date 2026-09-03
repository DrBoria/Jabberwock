import type { IHashmapMemory, IMementoLike } from "../../../../packages/types/src/protocol/backend-connector.ts"

/**
 * v4 Phase C1 (§4.3): synchronous memento adapter over the async file-backed hashmap
 * memory. The host memento (vscode `globalState`) is synchronous, so this adapter keeps
 * a per-session cache and persists every update through the hashmap memory.
 */
export class MementoAdapter implements IMementoLike {
	private readonly cache = new Map<string, unknown>()

	constructor(private readonly memory: IHashmapMemory) {}

	/** Preload the session cache from the persisted store (call once at startup). */
	async hydrate(): Promise<void> {
		for (const key of await this.memory.keys()) {
			const value = await this.memory.get(key)
			if (value !== undefined) this.cache.set(key, value)
		}
	}

	keys(): readonly string[] {
		return [...this.cache.keys()]
	}

	get<T = unknown>(key: string): T | undefined {
		return this.cache.get(key) as T | undefined
	}

	update(key: string, value: unknown): PromiseLike<void> {
		this.cache.set(key, value)
		return this.memory.set(key, value)
	}
}
