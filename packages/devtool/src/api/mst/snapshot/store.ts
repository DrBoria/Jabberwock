import type { BackendStore, FrontendBridge } from "../types.js"
import { truncateDeep, paginateSnapshot } from "./truncate.js"
import { discoverStoreTree, resolvePath, resolveNestedPath } from "./tree.js"

export async function getBackendStoreGuide(backendStore: BackendStore | undefined): Promise<string> {
	if (!backendStore) {
		return JSON.stringify({ error: "Backend store not available" })
	}
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}

	const tree = discoverStoreTree(mstStore as Record<string, unknown>)

	return JSON.stringify({
		guide: true,
		env: "backend",
		message: "Available backend stores. Use get_store_state env=backend store=<name> to inspect.",
		stores: tree,
		hint: 'Add limit=N (max 10) and cursor=N (skip from end) for pagination. Use path="sub.store" for deep access.',
	})
}

export async function getFrontendStoreGuide(frontendBridge: FrontendBridge | undefined): Promise<string> {
	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	try {
		const snapshot = await frontendBridge.getRootSnapshot()
		const tree = discoverStoreTree(snapshot as Record<string, unknown>)

		return JSON.stringify({
			guide: true,
			env: "frontend",
			message: "Available frontend stores. Use get_store_state env=frontend store=<name> to inspect.",
			stores: tree,
			hint: 'Add limit=N (max 10) and cursor=N (skip from end) for pagination. Use path="sub.store" for deep access.',
		})
	} catch (err) {
		return JSON.stringify({ error: `Failed to get frontend state: ${(err as Error).message}` })
	}
}

export async function getFrontendStoreHelper(
	frontendBridge: FrontendBridge,
	store?: string,
	path?: string,
	cursor?: number,
	limit?: number,
	fields?: string,
): Promise<string> {
	try {
		const snapshot = await frontendBridge.getRootSnapshot()
		if (store) {
			const storeData = resolveNestedPath(snapshot as Record<string, unknown>, store)
			if (storeData === undefined) {
				return JSON.stringify({ error: `Store "${store}" not found` })
			}
			if (path) {
				const resolved = resolvePath(storeData as Record<string, unknown>, path)
				if (resolved === undefined) {
					return JSON.stringify({ error: `Path "${path}" not found in store "${store}"` })
				}
				const truncated = truncateDeep(resolved, 5, undefined, 0, 10, 500, cursor, limit)
				return JSON.stringify(truncated)
			}
			return getFrontendStoreData(storeData as Record<string, unknown>, cursor, limit, fields)
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

function getFrontendStoreData(
	storeData: Record<string, unknown>,
	cursor?: number,
	limit?: number,
	fields?: string,
): string {
	const entries = Object.entries(storeData)
	const paginated = paginateSnapshot(entries, cursor, limit, fields)
	return JSON.stringify({
		store: paginated,
		totalKeys: entries.length,
	})
}

export function getBackendStoreHelper(
	backendStore: BackendStore,
	store?: string,
	path?: string,
	cursor?: number,
	limit?: number,
	fields?: string,
): string {
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}

	if (store) {
		const storeData = resolveNestedPath(mstStore as Record<string, unknown>, store)
		if (storeData === undefined) {
			return JSON.stringify({ error: `Store "${store}" not found` })
		}
		if (path) {
			const resolved = resolvePath(storeData as Record<string, unknown>, path)
			if (resolved === undefined) {
				return JSON.stringify({ error: `Path "${path}" not found in store "${store}"` })
			}
			const truncated = truncateDeep(resolved, 5, undefined, 0, 10, 500, cursor, limit)
			return JSON.stringify(truncated)
		}
		return getBackendStoreData(storeData as Record<string, unknown>, cursor, limit, fields)
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

function getBackendStoreData(
	storeData: Record<string, unknown>,
	cursor?: number,
	limit?: number,
	fields?: string,
): string {
	try {
		const entries = Object.entries(storeData)
		const paginated = paginateSnapshot(entries, cursor, limit, fields)
		return JSON.stringify({
			store: paginated,
			totalKeys: entries.length,
		})
	} catch (error) {
		return JSON.stringify({
			error: `Failed to serialize store data: ${error instanceof Error ? error.message : String(error)}`,
		})
	}
}
