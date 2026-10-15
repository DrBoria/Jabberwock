/**
 * Unified query contract.
 *
 * Every queryable entity — backend console, frontend console, each store
 * framework (mobx / redux / zustand / apollo), and the action log — returns
 * data through this same shape. A full store or a full action list is never
 * dumped at once: results are strictly paginated, optionally filtered to a
 * subset of fields (GraphQL-style), and searchable by content.
 *
 * Ordering is **newest-first by default**: the most recent records come first,
 * so `cursor: 0` yields the latest page.
 */

/** A single queryable record. The concrete shape is entity-specific. */
export type QueryItem = Record<string, unknown>

/**
 * The result of any query. `items` is the current page (already newest-first,
 * already field-projected). `total` is the full count before pagination.
 * `cursor` is the cursor to pass back to fetch the next (older) page.
 */
export interface QueryResult<T extends QueryItem = QueryItem> {
	items: T[]
	/** Total number of matching records (before pagination). */
	total: number
	/** Cursor for the next (older) page. Equals `total` when exhausted. */
	cursor: number
	/** True when there is an older page to fetch. */
	hasMore: boolean
	/** Present when the query targets an entity that is unavailable. */
	error?: string
}

/** Sort direction. `newest` (default) puts the most recent records first. */
export type QuerySort = "newest" | "oldest"

/** Parameters accepted by every query. */
export interface QueryParams {
	/** Number of records to return (default 10, max 50). */
	limit?: number
	/** Number of records to skip from the newest end (default 0). */
	cursor?: number
	/**
	 * Comma-separated field names to project from each record (GraphQL-style).
	 * When set, only these fields are included on each item.
	 */
	fields?: string
	/** Case-insensitive content search (matches any field value). */
	query?: string
	/**
	 * Type filter: only records whose `type` field contains this substring
	 * (case-insensitive). E.g. `error` → only errors, `warning` → only
	 * warnings. Records without a `type` field are excluded when set.
	 */
	type?: string
	/** Sort direction. Default `newest`. */
	sort?: QuerySort
}

/** The default page size for every query. */
export const DEFAULT_QUERY_LIMIT = 10
/** The hard maximum page size for every query. */
export const MAX_QUERY_LIMIT = 50

/** Clamp a requested limit into the allowed range. */
export function clampLimit(limit?: number): number {
	if (!limit || limit < 1) return DEFAULT_QUERY_LIMIT
	return Math.min(limit, MAX_QUERY_LIMIT)
}

/**
 * Parse a GraphQL-style `fields` string ("id,tokensOut") into a set.
 * Returns `undefined` when no projection was requested (keep all fields).
 */
export function parseFields(fields?: string): Set<string> | undefined {
	if (!fields) return undefined
	const set = new Set<string>()
	for (const raw of fields.split(",")) {
		const f = raw.trim()
		if (f) set.add(f)
	}
	return set.size > 0 ? set : undefined
}

/**
 * Project each record down to the requested fields. Records that lack every
 * requested field are dropped.
 */
export function projectFields<T extends QueryItem>(items: T[], fields?: Set<string>): T[] {
	if (!fields) return items
	return items
		.map((item) => {
			const projected: Record<string, unknown> = {}
			let hasAny = false
			for (const key of fields) {
				if (key in item) {
					projected[key] = item[key]
					hasAny = true
				}
			}
			return hasAny ? projected : undefined
		})
		.filter((item): item is T => item !== undefined)
}

/**
 * Content search across a record: matches the query against every stringified
 * field value (case-insensitive substring).
 */
export function matchesQuery(item: QueryItem, query: string): boolean {
	const q = query.toLowerCase()
	return Object.values(item).some((v) => {
		if (typeof v === "string") return v.toLowerCase().includes(q)
		if (v === null || v === undefined) return false
		try {
			return JSON.stringify(v).toLowerCase().includes(q)
		} catch {
			return false
		}
	})
}

/**
 * The single pagination + projection + search pipeline every entity uses.
 *
 * @param items  The full record list, **already in newest-first order**
 *               (index 0 = most recent). Callers are responsible for ordering.
 * @param params Pagination / projection / search parameters.
 * @returns A {@link QueryResult} with the current page.
 */
export function runQuery<T extends QueryItem>(items: T[], params: QueryParams = {}): QueryResult<T> {
	const limit = clampLimit(params.limit)
	const cursor = params.cursor && params.cursor > 0 ? params.cursor : 0
	const fields = parseFields(params.fields)
	const query = params.query
	const typeFilter = params.type?.toLowerCase()
	const sort = params.sort ?? "newest"

	let filtered = items
	if (typeFilter) {
		filtered = filtered.filter((item) => {
			const t = item.type
			return typeof t === "string" && t.toLowerCase().includes(typeFilter)
		})
	}
	if (query) filtered = filtered.filter((item) => matchesQuery(item, query))
	const total = filtered.length

	if (sort === "oldest") filtered = filtered.slice().reverse()

	// Newest-first: the newest page is at the END of a chronological array, but
	// we receive items already newest-first, so the first page is simply the
	// head of the array offset by the cursor.
	const start = cursor
	const end = start + limit
	const page = filtered.slice(start, end)

	const projected = projectFields(page, fields)

	return {
		items: projected,
		total,
		cursor: end,
		hasMore: end < total,
	}
}

/**
 * Build an error result for an unavailable entity — the domain reports the
 * unavailability up through the same contract instead of throwing.
 */
export function unavailableResult(entity: string): QueryResult {
	return {
		items: [],
		total: 0,
		cursor: 0,
		hasMore: false,
		error: `${entity} is not available`,
	}
}
