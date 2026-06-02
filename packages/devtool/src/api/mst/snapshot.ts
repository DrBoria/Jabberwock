import type { BackendStore, FrontendBridge } from "./types.js"

export interface GetStoreStateParams {
	env?: "backend" | "frontend"
	store?: string
	path?: string
	cursor?: number
	limit?: number
	/** Comma-separated field names to extract from array elements (e.g. "id,tokensOut"). Only these fields are returned per element. */
	fields?: string
}

export async function getStoreState(
	params: GetStoreStateParams,
	backendStore: BackendStore | undefined,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	const { env, store, path, cursor = 0, limit = 10, fields } = params

	// ── Guide mode: no env specified → show top-level environments guide ──
	if (!env) {
		return JSON.stringify({
			guide: true,
			message: "Specify an environment with `env` parameter. Available environments:",
			environments: {
				backend: {
					description: "Extension host MST store",
					usage: 'get_store_state env="backend" [store="storeName"] [limit=N] [cursor=N]',
					available: backendStore?.getMstStore()
						? Object.keys(backendStore.getMstStore() as Record<string, unknown>)
						: [],
				},
				frontend: {
					description: "Webview React app MST store (via bridge)",
					usage: 'get_store_state env="frontend" [store="storeName"] [limit=N] [cursor=N]',
				},
			},
		})
	}

	// ── Guide mode: env specified but no store → show store tree ──
	if (!store) {
		if (env === "backend") {
			return getBackendStoreGuide(backendStore)
		}
		return getFrontendStoreGuide(frontendBridge)
	}

	// ── Normal mode: env + store specified ──
	if (env === "backend") {
		if (!backendStore) {
			return JSON.stringify({ error: "Backend store not available" })
		}
		return getBackendStoreHelper(backendStore, store, path, cursor, limit, fields)
	}

	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	return getFrontendStoreHelper(frontendBridge, store, path, cursor, limit, fields)
}

/**
 * Recursively discover nested store structure up to a max depth.
 * Returns a map of path → { type, sub? } for the guide tree.
 */
function discoverStoreTree(
	obj: Record<string, unknown>,
	prefix = "",
	depth = 0,
	maxDepth = 3,
): Record<string, { type: string; sub?: string[] }> {
	const tree: Record<string, { type: string; sub?: string[] }> = {}

	for (const [key, value] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${key}` : key

		if (value !== null && typeof value === "object" && !Array.isArray(value)) {
			tree[path] = { type: "object" }
			if (depth < maxDepth) {
				const childKeys = Object.keys(value as Record<string, unknown>)
				if (childKeys.length > 0) {
					tree[path].sub = childKeys
					// Recurse for deeper discovery
					const deeper = discoverStoreTree(value as Record<string, unknown>, path, depth + 1, maxDepth)
					Object.assign(tree, deeper)
				}
			}
		} else if (Array.isArray(value)) {
			tree[path] = { type: `array[${value.length}]` }
		} else {
			tree[path] = { type: typeof value }
		}
	}

	return tree
}

async function getBackendStoreGuide(backendStore: BackendStore | undefined): Promise<string> {
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

async function getFrontendStoreGuide(frontendBridge: FrontendBridge | undefined): Promise<string> {
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

async function getFrontendStoreHelper(
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
			const storeData = (snapshot as Record<string, unknown>)[store]
			if (storeData === undefined) {
				return JSON.stringify({ error: `Store "${store}" not found` })
			}
			if (path) {
				const resolved = resolvePath(storeData as Record<string, unknown>, path)
				return JSON.stringify(resolved ?? { error: `Path "${path}" not found in store "${store}"` })
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

function getBackendStoreHelper(
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
		const storeData = (mstStore as Record<string, unknown>)[store]
		if (storeData === undefined) {
			return JSON.stringify({ error: `Store "${store}" not found` })
		}
		if (path) {
			const resolved = resolvePath(storeData as Record<string, unknown>, path)
			return JSON.stringify(resolved ?? { error: `Path "${path}" not found in store "${store}"` })
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

/**
 * Recursively truncate a value — replaces deeply nested arrays with a short preview
 * and applies `fields` filtering to array-of-objects elements.
 */
function truncateDeep(value: unknown, maxPreview = 5, fields?: string[]): unknown {
	if (value === undefined) {
		return "(undefined)"
	}
	if (Array.isArray(value)) {
		// Process each element first (recursive)
		const processed = value.map((item) => truncateDeep(item, maxPreview, undefined))
		// Truncate the array itself
		if (processed.length > maxPreview) {
			return [
				fields ? filterFields(processed[0] as Record<string, unknown>, fields) : processed[0],
				fields ? filterFields(processed[1] as Record<string, unknown>, fields) : processed[1],
				`...(${processed.length - 4} more items)...`,
				fields
					? filterFields(processed[processed.length - 2] as Record<string, unknown>, fields)
					: processed[processed.length - 2],
				fields
					? filterFields(processed[processed.length - 1] as Record<string, unknown>, fields)
					: processed[processed.length - 1],
			]
		}
		if (fields) {
			return processed.map((item) => filterFields(item as Record<string, unknown>, fields))
		}
		return processed
	}
	if (value !== null && typeof value === "object") {
		const obj = value as Record<string, unknown>
		const result: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(obj)) {
			result[k] = truncateDeep(v, maxPreview, undefined)
		}
		return result
	}
	return value
}

/**
 * Extract only the specified fields from an object.
 */
function filterFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const field of fields) {
		if (field in obj) {
			result[field] = obj[field]
		}
	}
	return result
}

/**
 * Paginate entries in reverse order (newest first) with cursor-based pagination.
 * @param entries - Array of [key, value] pairs
 * @param cursor - Number of entries to skip from the end (default: 0)
 * @param limit - Maximum entries to return (default: 10)
 * @param fields - Optional comma-separated field names to extract from array elements
 */
function paginateSnapshot(
	entries: [string, unknown][],
	cursor = 0,
	limit = 10,
	fields?: string,
): Record<string, unknown> {
	if (!entries || !Array.isArray(entries) || entries.length === 0) {
		return {}
	}
	const endIndex = Math.max(0, entries.length - cursor)
	const startIndex = Math.max(0, endIndex - limit)
	const sliced = entries.slice(startIndex, endIndex).reverse()
	const fieldList = fields
		? fields
				.split(",")
				.map((f) => f.trim())
				.filter(Boolean)
		: undefined

	const limited = sliced.map(([k, v]) => {
		const processed = truncateDeep(v, 5, fieldList)
		return [k, processed] as [string, unknown]
	})
	return Object.fromEntries(limited)
}
