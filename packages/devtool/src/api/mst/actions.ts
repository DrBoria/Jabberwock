import type { BackendStore, FrontendBridge } from "./types.js"

export interface ActionParams {
	env: "backend" | "frontend"
	store?: string
	cursor?: number
	limit?: number
}

export interface FilterActionParams {
	env: "backend" | "frontend"
	store?: string
	pattern: string
	cursor?: number
	limit?: number
}

export interface SearchActionParams {
	env: "backend" | "frontend"
	store?: string
	query: string
	cursor?: number
	limit?: number
}

export interface ActionLogParams {
	env: "backend" | "frontend"
	store?: string
	cursor?: number
	limit?: number
}

interface ActionEntry {
	key: string
	type: string
	value: string
}

function paginate<T>(items: T[], cursor: number, limit: number): T[] {
	return items.slice(cursor, cursor + limit)
}

// ── Backend Store Actions ────────────────────────────────────────────

export function getStoreActions(params: ActionParams, backendStore: BackendStore | undefined): string {
	if (!backendStore) {
		return JSON.stringify({ error: "Backend store not available" })
	}
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}
	const source = params.store ? (mstStore as Record<string, unknown>)[params.store] : mstStore
	if (!source) {
		return JSON.stringify({ error: `Store "${params.store}" not found` })
	}
	const actions = extractActions(source as Record<string, unknown>)
	const paginated = paginate(actions, params.cursor ?? 0, params.limit ?? 50)
	return JSON.stringify({
		actions: paginated,
		totalActions: actions.length,
		cursor: (params.cursor ?? 0) + paginated.length,
	})
}

export function filterActions(params: FilterActionParams, backendStore: BackendStore | undefined): string {
	if (!backendStore) {
		return JSON.stringify({ error: "Backend store not available" })
	}
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}
	const source = params.store ? (mstStore as Record<string, unknown>)[params.store] : mstStore
	if (!source) {
		return JSON.stringify({ error: `Store "${params.store}" not found` })
	}
	const allActions = extractActions(source as Record<string, unknown>)
	const pattern = params.pattern.toLowerCase()
	const filtered = allActions.filter((a) => a.key.toLowerCase().includes(pattern))
	const paginated = paginate(filtered, params.cursor ?? 0, params.limit ?? 50)
	return JSON.stringify({
		actions: paginated,
		totalActions: filtered.length,
		cursor: (params.cursor ?? 0) + paginated.length,
	})
}

export function searchActions(params: SearchActionParams, backendStore: BackendStore | undefined): string {
	if (!backendStore) {
		return JSON.stringify({ error: "Backend store not available" })
	}
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}
	const source = params.store ? (mstStore as Record<string, unknown>)[params.store] : mstStore
	if (!source) {
		return JSON.stringify({ error: `Store "${params.store}" not found` })
	}
	const allActions = extractActions(source as Record<string, unknown>)
	const query = params.query.toLowerCase()
	const results = allActions.filter(
		(a) => a.key.toLowerCase().includes(query) || a.value.toLowerCase().includes(query),
	)
	const paginated = paginate(results, params.cursor ?? 0, params.limit ?? 50)
	return JSON.stringify({
		actions: paginated,
		totalActions: results.length,
		cursor: (params.cursor ?? 0) + paginated.length,
	})
}

export function countActions(params: ActionParams, backendStore: BackendStore | undefined): string {
	if (!backendStore) {
		return JSON.stringify({ error: "Backend store not available" })
	}
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}
	const source = params.store ? (mstStore as Record<string, unknown>)[params.store] : mstStore
	if (!source) {
		return JSON.stringify({ error: `Store "${params.store}" not found` })
	}
	const actions = extractActions(source as Record<string, unknown>)
	return JSON.stringify({ count: actions.length })
}

export function getStoreActionsLog(params: ActionLogParams, backendStore: BackendStore | undefined): string {
	if (!backendStore) {
		return JSON.stringify({ error: "Backend store not available" })
	}
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}
	const source = params.store ? (mstStore as Record<string, unknown>)[params.store] : mstStore
	if (!source) {
		return JSON.stringify({ error: `Store "${params.store}" not found` })
	}
	const actions = extractActions(source as Record<string, unknown>)
	const paginated = paginate(actions, params.cursor ?? 0, params.limit ?? 50)
	return JSON.stringify({
		actions: paginated,
		totalActions: actions.length,
		cursor: (params.cursor ?? 0) + paginated.length,
	})
}

// ── Frontend Store Actions ───────────────────────────────────────────

export async function getFrontendStoreActions(
	params: ActionParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	try {
		const buffer = await frontendBridge.getActionBuffer()
		return getBufferActions(buffer, params.store, params.cursor, params.limit)
	} catch (err) {
		return JSON.stringify({ error: `Failed to get frontend actions: ${(err as Error).message}` })
	}
}

export async function filterFrontendActions(
	params: FilterActionParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	try {
		const buffer = await frontendBridge.getActionBuffer()
		return filterBufferActions(buffer, params.store, params.pattern, params.cursor, params.limit)
	} catch (err) {
		return JSON.stringify({ error: `Failed to filter frontend actions: ${(err as Error).message}` })
	}
}

export async function searchFrontendActions(
	params: SearchActionParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	try {
		const buffer = await frontendBridge.getActionBuffer()
		return searchBufferActions(buffer, params.store, params.query, params.cursor, params.limit)
	} catch (err) {
		return JSON.stringify({ error: `Failed to search frontend actions: ${(err as Error).message}` })
	}
}

export async function countFrontendActions(
	params: ActionParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	try {
		const buffer = await frontendBridge.getActionBuffer()
		return countBufferActions(buffer, params.store)
	} catch (err) {
		return JSON.stringify({ error: `Failed to count frontend actions: ${(err as Error).message}` })
	}
}

export async function getFrontendStoreActionsLog(
	params: ActionLogParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	try {
		const buffer = await frontendBridge.getActionBuffer()
		return getStoreActionsLogFromBuffer(buffer, params.store, params.cursor, params.limit)
	} catch (err) {
		return JSON.stringify({
			error: `Failed to get frontend actions log: ${(err as Error).message}`,
		})
	}
}

// ── Buffer helpers ───────────────────────────────────────────────────

function extractActions(obj: Record<string, unknown>): ActionEntry[] {
	const result: ActionEntry[] = []
	const seen = new Set<string>()

	function walk(o: unknown, prefix: string): void {
		if (o === null || o === undefined) return
		if (typeof o !== "object") return
		for (const [key, value] of Object.entries(o as Record<string, unknown>)) {
			const fullKey = prefix ? `${prefix}.${key}` : key
			if (key.endsWith("Action") || key.endsWith("Actions") || key === "actions") {
				const entry: ActionEntry = {
					key: fullKey,
					type: Array.isArray(value) ? "array" : typeof value,
					value: truncate(JSON.stringify(value), 200),
				}
				const dedup = `${fullKey}:${entry.value}`
				if (!seen.has(dedup)) {
					seen.add(dedup)
					result.push(entry)
				}
			}
			if (typeof value === "object" && value !== null) {
				walk(value, fullKey)
			}
		}
	}
	walk(obj, "")
	return result
}

function truncate(str: string, maxLen: number): string {
	return str.length > maxLen ? str.slice(0, maxLen) + "..." : str
}

function getBufferActions(buffer: unknown[], store?: string, cursor = 0, limit = 50): string {
	const filtered = store
		? buffer.filter((entry: unknown) => (entry as Record<string, unknown>)?.store === store)
		: buffer
	const paginated = filtered.slice(cursor, cursor + limit)
	const formatted = paginated.map((entry: unknown) => {
		const e = entry as Record<string, unknown>
		return {
			type: e.type ?? "unknown",
			action: e.action ?? "unknown",
			store: e.store ?? "unknown",
			timestamp: e.timestamp ?? "unknown",
		}
	})
	return JSON.stringify({
		actions: formatted,
		totalActions: filtered.length,
		cursor: cursor + paginated.length,
	})
}

function filterBufferActions(buffer: unknown[], store?: string, pattern?: string, cursor = 0, limit = 50): string {
	let filtered = buffer
	if (store) {
		filtered = filtered.filter((entry: unknown) => (entry as Record<string, unknown>)?.store === store)
	}
	if (pattern) {
		const lower = pattern.toLowerCase()
		filtered = filtered.filter((entry: unknown) => {
			const e = entry as Record<string, unknown>
			return (
				String(e.type).toLowerCase().includes(lower) ||
				String(e.action).toLowerCase().includes(lower) ||
				String(e.store).toLowerCase().includes(lower)
			)
		})
	}
	const paginated = filtered.slice(cursor, cursor + limit)
	const formatted = paginated.map((entry: unknown) => {
		const e = entry as Record<string, unknown>
		return {
			type: e.type ?? "unknown",
			action: e.action ?? "unknown",
			store: e.store ?? "unknown",
			timestamp: e.timestamp ?? "unknown",
		}
	})
	return JSON.stringify({
		actions: formatted,
		totalActions: filtered.length,
		cursor: cursor + paginated.length,
	})
}

function searchBufferActions(buffer: unknown[], store?: string, query?: string, cursor = 0, limit = 50): string {
	let filtered = buffer
	if (store) {
		filtered = filtered.filter((entry: unknown) => (entry as Record<string, unknown>)?.store === store)
	}
	if (query) {
		const lower = query.toLowerCase()
		filtered = filtered.filter((entry: unknown) => {
			const e = entry as Record<string, unknown>
			const searchable = `${e.type ?? ""} ${e.action ?? ""} ${e.store ?? ""}`
			return searchable.toLowerCase().includes(lower)
		})
	}
	const paginated = filtered.slice(cursor, cursor + limit)
	const formatted = paginated.map((entry: unknown) => {
		const e = entry as Record<string, unknown>
		return {
			type: e.type ?? "unknown",
			action: e.action ?? "unknown",
			store: e.store ?? "unknown",
			timestamp: e.timestamp ?? "unknown",
		}
	})
	return JSON.stringify({
		actions: formatted,
		totalActions: filtered.length,
		cursor: cursor + paginated.length,
	})
}

function countBufferActions(buffer: unknown[], store?: string): string {
	const filtered = store
		? buffer.filter((entry: unknown) => (entry as Record<string, unknown>)?.store === store)
		: buffer
	return JSON.stringify({ count: filtered.length })
}

function getStoreActionsLogFromBuffer(buffer: unknown[], store?: string, cursor = 0, limit = 50): string {
	const filtered = store
		? buffer.filter((entry: unknown) => (entry as Record<string, unknown>)?.store === store)
		: buffer
	const paginated = filtered.slice(cursor, cursor + limit)
	const formatted = paginated.map((entry: unknown) => {
		const e = entry as Record<string, unknown>
		return {
			type: e.type ?? "unknown",
			action: e.action ?? "unknown",
			store: e.store ?? "unknown",
			timestamp: e.timestamp ?? "unknown",
		}
	})
	return JSON.stringify({
		actions: formatted,
		totalActions: filtered.length,
		cursor: cursor + paginated.length,
	})
}
