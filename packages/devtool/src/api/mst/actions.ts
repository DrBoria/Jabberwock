import type { BackendStore, FrontendBridge } from "./types.js"
import {
	extractActions,
	getBufferActions,
	filterBufferActions,
	searchBufferActions,
	countBufferActions,
	getStoreActionsLogFromBuffer,
} from "./actions-buffer.js"

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

function paginate<T>(items: T[], cursor: number, limit: number): T[] {
	return items.slice(cursor, cursor + limit)
}

function getSource(params: { store?: string }, mstStore: Record<string, unknown>): Record<string, unknown> | undefined {
	const source = params.store ? (mstStore as Record<string, unknown>)[params.store] : mstStore
	if (!source) {
		return undefined
	}
	return source as Record<string, unknown>
}

function handleBackendAction(
	params: { store?: string; cursor?: number; limit?: number },
	backendStore: BackendStore | undefined,
	fn: (source: Record<string, unknown>, cursor: number, limit: number) => string,
): string {
	if (!backendStore) {
		return JSON.stringify({ error: "Backend store not available" })
	}
	const mstStore = backendStore.getMstStore()
	if (!mstStore) {
		return JSON.stringify({ error: "MST store not available" })
	}
	const source = getSource(params, mstStore as Record<string, unknown>)
	if (!source) {
		return JSON.stringify({ error: `Store "${params.store}" not found` })
	}
	return fn(source, params.cursor ?? 0, params.limit ?? 50)
}

// ── Backend Store Actions ────────────────────────────────────────────

export function getStoreActions(params: ActionParams, backendStore: BackendStore | undefined): string {
	return handleBackendAction(params, backendStore, (source, cursor, limit) => {
		const actions = extractActions(source)
		const paginated = paginate(actions, cursor, limit)
		return JSON.stringify({ actions: paginated, totalActions: actions.length, cursor: cursor + paginated.length })
	})
}

export function filterActions(params: FilterActionParams, backendStore: BackendStore | undefined): string {
	return handleBackendAction(params, backendStore, (source, cursor, limit) => {
		const allActions = extractActions(source)
		const pattern = params.pattern.toLowerCase()
		const filtered = allActions.filter((a) => a.key.toLowerCase().includes(pattern))
		const paginated = paginate(filtered, cursor, limit)
		return JSON.stringify({ actions: paginated, totalActions: filtered.length, cursor: cursor + paginated.length })
	})
}

export function searchActions(params: SearchActionParams, backendStore: BackendStore | undefined): string {
	return handleBackendAction(params, backendStore, (source, cursor, limit) => {
		const allActions = extractActions(source)
		const query = params.query.toLowerCase()
		const results = allActions.filter(
			(a) => a.key.toLowerCase().includes(query) || a.value.toLowerCase().includes(query),
		)
		const paginated = paginate(results, cursor, limit)
		return JSON.stringify({ actions: paginated, totalActions: results.length, cursor: cursor + paginated.length })
	})
}

export function countActions(params: ActionParams, backendStore: BackendStore | undefined): string {
	return handleBackendAction(params, backendStore, (source) => {
		const actions = extractActions(source)
		return JSON.stringify({ count: actions.length })
	})
}

export function getStoreActionsLog(params: ActionLogParams, backendStore: BackendStore | undefined): string {
	return handleBackendAction(params, backendStore, (source, cursor, limit) => {
		const actions = extractActions(source)
		const paginated = paginate(actions, cursor, limit)
		return JSON.stringify({ actions: paginated, totalActions: actions.length, cursor: cursor + paginated.length })
	})
}

// ── Frontend Store Actions ───────────────────────────────────────────

async function handleFrontendAction(
	frontendBridge: FrontendBridge | undefined,
	fn: (buffer: unknown[]) => string,
	actionName: string,
): Promise<string> {
	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	try {
		const buffer = await frontendBridge.getActionBuffer()
		return fn(buffer)
	} catch (err) {
		return JSON.stringify({ error: `Failed to ${actionName}: ${(err as Error).message}` })
	}
}

export async function getFrontendStoreActions(
	params: ActionParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	return handleFrontendAction(
		frontendBridge,
		(buffer) => getBufferActions(buffer, params.store, params.cursor, params.limit),
		"get frontend actions",
	)
}

export async function filterFrontendActions(
	params: FilterActionParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	return handleFrontendAction(
		frontendBridge,
		(buffer) => filterBufferActions(buffer, params.store, params.pattern, params.cursor, params.limit),
		"filter frontend actions",
	)
}

export async function searchFrontendActions(
	params: SearchActionParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	return handleFrontendAction(
		frontendBridge,
		(buffer) => searchBufferActions(buffer, params.store, params.query, params.cursor, params.limit),
		"search frontend actions",
	)
}

export async function countFrontendActions(
	params: ActionParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	return handleFrontendAction(
		frontendBridge,
		(buffer) => countBufferActions(buffer, params.store),
		"count frontend actions",
	)
}

export async function getFrontendStoreActionsLog(
	params: ActionLogParams,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	return handleFrontendAction(
		frontendBridge,
		(buffer) => getStoreActionsLogFromBuffer(buffer, params.store, params.cursor, params.limit),
		"get frontend actions log",
	)
}
