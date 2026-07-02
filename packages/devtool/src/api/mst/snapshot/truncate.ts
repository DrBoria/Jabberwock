function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

function truncateString(value: string, maxStrLength: number): string {
	if (value.length <= maxStrLength) {
		return value
	}
	return value.slice(0, maxStrLength) + `... (${value.length - maxStrLength} more chars)`
}

function truncateScalar(value: unknown, maxStrLength: number): unknown {
	if (value === undefined) return null
	if (typeof value === "string") return truncateString(value, maxStrLength)
	return undefined
}

function truncateValue(
	value: unknown,
	maxPreview: number,
	fields: string[] | undefined,
	depth: number,
	maxDepth: number,
	maxStrLength: number,
	cursor: number,
	limit: number,
): unknown {
	if (Array.isArray(value))
		return truncateArray(value, maxPreview, fields, depth, maxDepth, maxStrLength, cursor, limit)
	if (isPlainObject(value)) return truncateObject(value, maxPreview, depth, maxDepth, maxStrLength)
	return value
}

function buildTruncatedArrayPreview(processed: unknown[], fields: string[] | undefined, maxPreview: number): unknown[] {
	if (processed.length <= maxPreview) {
		if (!fields) {
			return processed
		}
		return processed.map((item) => filterFields(item as Record<string, unknown>, fields))
	}

	const getItem = (item: unknown): unknown => {
		if (!fields) {
			return item
		}
		return filterFields(item as Record<string, unknown>, fields)
	}

	return [
		getItem(processed[0]),
		getItem(processed[1]),
		`...(${processed.length - 4} more items)...`,
		getItem(processed[processed.length - 2]),
		getItem(processed[processed.length - 1]),
	]
}

function truncateArray(
	value: unknown[],
	maxPreview: number,
	fields: string[] | undefined,
	depth: number,
	maxDepth: number,
	maxStrLength: number,
	cursor: number,
	limit: number,
): unknown {
	const endIndex = Math.max(0, value.length - cursor)
	const startIndex = Math.max(0, endIndex - limit)
	const sliced = value.slice(startIndex, endIndex)

	const processed = sliced.map((item) => truncateDeep(item, maxPreview, undefined, depth + 1, maxDepth, maxStrLength))
	return buildTruncatedArrayPreview(processed, fields, maxPreview)
}

function truncateObject(
	value: Record<string, unknown>,
	maxPreview: number,
	depth: number,
	maxDepth: number,
	maxStrLength: number,
): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(value)) {
		if (v === undefined) {
			continue
		}
		result[k] = truncateDeep(v, maxPreview, undefined, depth + 1, maxDepth, maxStrLength)
	}
	return result
}

function truncateDeep(
	value: unknown,
	maxPreview = 5,
	fields?: string[],
	depth = 0,
	maxDepth = 10,
	maxStrLength = 500,
	cursor = 0,
	limit = 10,
): unknown {
	if (depth > maxDepth) return "[Truncated: max depth reached]"
	const truncated = truncateScalar(value, maxStrLength)
	if (truncated !== undefined) return truncated
	return truncateValue(value, maxPreview, fields, depth, maxDepth, maxStrLength, cursor, limit)
}

function filterFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const field of fields) {
		if (field in obj) {
			result[field] = obj[field]
		}
	}
	return result
}

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
		if (fieldList && typeof processed === "object" && !Array.isArray(processed) && processed !== null) {
			return [k, filterFields(processed as Record<string, unknown>, fieldList)] as [string, unknown]
		}
		return [k, processed] as [string, unknown]
	})
	return Object.fromEntries(limited)
}

export { isPlainObject, truncateDeep, filterFields, paginateSnapshot }
