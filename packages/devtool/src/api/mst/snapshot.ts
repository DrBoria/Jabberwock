import type { BackendStore, FrontendBridge } from "./types.js"

export interface GetStoreStateParams {
	env: "backend" | "frontend"
	store?: string
	path?: string
	cursor?: number
	limit?: number
}

export async function getStoreState(
	params: GetStoreStateParams,
	backendStore: BackendStore | undefined,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	const { env, store, path, cursor = 0, limit = 50 } = params

	if (env === "backend") {
		if (!backendStore) {
			return JSON.stringify({ error: "Backend store not available" })
		}
		return getBackendStoreHelper(backendStore, store, path, cursor, limit)
	}

	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	return getFrontendStoreHelper(frontendBridge, store, path, cursor, limit)
}

async function getFrontendStoreHelper(
	frontendBridge: FrontendBridge,
	store?: string,
	path?: string,
	cursor?: number,
	limit?: number,
): Promise<string> {
	try {
		const snapshot = await frontendBridge.getRootSnapshot()
		if (store) {
			const storeData = (snapshot as Record<string, unknown>)[store]
			if (storeData === undefined) {
				return JSON.stringify({ error: `Store "${store}" not found` })
			}
			if (path) {
				const resolved = resolvePath(storeData as Record<string, unknown>, path)
				return JSON.stringify(resolved ?? { error: `Path "${path}" not found in store "${store}"` })
			}
			return getFrontendStoreData(storeData as Record<string, unknown>, cursor, limit)
		}
		const stores = Object.entries(snapshot as Record<string, unknown>).map(([key, value]) => ({
			name: key,
			keys: Object.keys((value as Record<string, unknown>) ?? {}).join(", "),
			entries: Object.entries((value as Record<string, unknown>) ?? {}).map(([k, v]) => ({
				key: k,
				type: typeof v,
			})),
		}))
		return JSON.stringify({ stores, totalStores: stores.length })
	} catch (err) {
		return JSON.stringify({ error: `Failed to get frontend state: ${(err as Error).message}` })
	}
}

function getFrontendStoreData(storeData: Record<string, unknown>, cursor?: number, limit?: number): string {
	const entries = Object.entries(storeData)
	const paginated = paginateSnapshot(entries, cursor, limit)
	return JSON.stringify({
		store: paginated,
		totalKeys: entries.length,
	})
}

function getBackendStoreHelper(
	backendStore: BackendStore,
	store?: string,
	path?: string,
	cursor?: number,
	limit?: number,
): string {
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}

	if (store) {
		const storeData = (mstStore as Record<string, unknown>)[store]
		if (storeData === undefined) {
			return JSON.stringify({ error: `Store "${store}" not found` })
		}
		if (path) {
			const resolved = resolvePath(storeData as Record<string, unknown>, path)
			return JSON.stringify(resolved ?? { error: `Path "${path}" not found in store "${store}"` })
		}
		return getBackendStoreData(storeData as Record<string, unknown>, cursor, limit)
	}
	const stores = Object.entries(mstStore).map(([key, value]) => ({
		name: key,
		keys: Object.keys((value as Record<string, unknown>) ?? {}).join(", "),
		entries: Object.entries((value as Record<string, unknown>) ?? {}).map(([k, v]) => ({
			key: k,
			type: typeof v,
		})),
	}))
	return JSON.stringify({ stores, totalStores: stores.length })
}

function getBackendStoreData(storeData: Record<string, unknown>, cursor?: number, limit?: number): string {
	const entries = Object.entries(storeData)
	const paginated = paginateSnapshot(entries, cursor, limit)
	return JSON.stringify({
		store: paginated,
		totalKeys: entries.length,
	})
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".")
	let current: unknown = obj
	for (const part of parts) {
		if (current === null || current === undefined || typeof current !== "object") {
			return undefined
		}
		current = (current as Record<string, unknown>)[part]
	}
	return current
}

function paginateSnapshot(entries: [string, unknown][], cursor = 0, limit = 50): Record<string, unknown> {
	if (cursor >= entries.length) {
		return {}
	}
	const sliced = entries.slice(cursor, cursor + limit)
	const limited = sliced.map(([k, v]) => {
		if (v !== null && typeof v === "object" && !Array.isArray(v)) {
			return [k, { "(keys)": Object.keys(v as Record<string, unknown>).join(", ") }] as [string, unknown]
		}
		return [k, v] as [string, unknown]
	})
	return Object.fromEntries(limited)
}
