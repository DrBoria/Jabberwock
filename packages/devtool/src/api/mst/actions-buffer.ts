interface ActionEntry {
	key: string
	type: string
	value: string
}

function isActionKey(key: string): boolean {
	return key.endsWith("Action") || key.endsWith("Actions") || key === "actions"
}

function truncate(str: string, maxLen: number): string {
	return str.length > maxLen ? str.slice(0, maxLen) + "..." : str
}

function addActionEntry(fullKey: string, value: unknown, result: ActionEntry[], seen: Set<string>): void {
	if (!isActionKey(fullKey.split(".").pop() ?? fullKey)) {
		return
	}
	const entry: ActionEntry = {
		key: fullKey,
		type: Array.isArray(value) ? "array" : typeof value,
		value: truncate(JSON.stringify(value), 200),
	}
	const dedup = `${fullKey}:${entry.value}`
	if (seen.has(dedup)) {
		return
	}
	seen.add(dedup)
	result.push(entry)
}

function walk(o: unknown, prefix: string, result: ActionEntry[], seen: Set<string>): void {
	if (o === null || o === undefined) {
		return
	}
	if (typeof o !== "object") {
		return
	}
	for (const [key, value] of Object.entries(o as Record<string, unknown>)) {
		const fullKey = prefix ? `${prefix}.${key}` : key
		addActionEntry(fullKey, value, result, seen)
		if (typeof value === "object" && value !== null) {
			walk(value, fullKey, result, seen)
		}
	}
}

export function extractActions(obj: Record<string, unknown>): ActionEntry[] {
	const result: ActionEntry[] = []
	const seen = new Set<string>()
	walk(obj, "", result, seen)
	return result
}

function formatBufferEntry(entry: unknown) {
	const e = entry as Record<string, unknown>
	return {
		type: "mst-action" as const,
		action: e.name ?? "unknown",
		store: String(e.path ?? "").replace(/^\//, "") || "root",
		timestamp: e.timestamp ?? "unknown",
	}
}

function filterByStore(buffer: unknown[], store?: string): unknown[] {
	if (!store) return buffer
	return buffer.filter((entry: unknown) => {
		const e = entry as Record<string, unknown>
		return String(e.path ?? "").includes(store)
	})
}

export function getBufferActions(buffer: unknown[], store?: string, cursor = 0, limit = 50): string {
	const filtered = filterByStore(buffer, store)
	const paginated = filtered.slice(cursor, cursor + limit)
	const formatted = paginated.map(formatBufferEntry)
	return JSON.stringify({
		actions: formatted,
		totalActions: filtered.length,
		cursor: cursor + paginated.length,
	})
}

export function filterBufferActions(
	buffer: unknown[],
	store?: string,
	pattern?: string,
	cursor = 0,
	limit = 50,
): string {
	let filtered = filterByStore(buffer, store)
	if (pattern) {
		const lower = pattern.toLowerCase()
		filtered = filtered.filter((entry: unknown) => {
			const e = entry as Record<string, unknown>
			return String(e.name).toLowerCase().includes(lower) || String(e.path).toLowerCase().includes(lower)
		})
	}
	const paginated = filtered.slice(cursor, cursor + limit)
	const formatted = paginated.map(formatBufferEntry)
	return JSON.stringify({
		actions: formatted,
		totalActions: filtered.length,
		cursor: cursor + paginated.length,
	})
}

export function searchBufferActions(buffer: unknown[], store?: string, query?: string, cursor = 0, limit = 50): string {
	let filtered = filterByStore(buffer, store)
	if (query) {
		const lower = query.toLowerCase()
		filtered = filtered.filter((entry: unknown) => {
			const e = entry as Record<string, unknown>
			const searchable = `${e.name ?? ""} ${e.path ?? ""}`
			return searchable.toLowerCase().includes(lower)
		})
	}
	const paginated = filtered.slice(cursor, cursor + limit)
	const formatted = paginated.map(formatBufferEntry)
	return JSON.stringify({
		actions: formatted,
		totalActions: filtered.length,
		cursor: cursor + paginated.length,
	})
}

export function countBufferActions(buffer: unknown[], store?: string): string {
	const filtered = filterByStore(buffer, store)
	return JSON.stringify({ count: filtered.length })
}

export function getStoreActionsLogFromBuffer(buffer: unknown[], store?: string, cursor = 0, limit = 50): string {
	const filtered = filterByStore(buffer, store)
	const paginated = filtered.slice(cursor, cursor + limit)
	const formatted = paginated.map(formatBufferEntry)
	return JSON.stringify({
		actions: formatted,
		totalActions: filtered.length,
		cursor: cursor + paginated.length,
	})
}
