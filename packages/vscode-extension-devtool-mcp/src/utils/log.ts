/**
 * Pure log formatting / filtering helpers. Shared by the backend console
 * (getConsole / searchConsole) and the state `getLogs` tool so the
 * `[timestamp][LEVEL] message` shape lives in one place.
 *
 * Merged from the log helpers of the former `backend/factories/factory-helpers.ts`.
 */
import type { DiagnosticLog } from "../types.js"
import { clampLimit, parseFields, projectFields, type QueryItem, type QueryResult } from "../mcp/queries.js"

/**
 * Format a single diagnostic log entry as a single console line.
 */
export function formatLogLine(entry: DiagnosticLog): string {
	const timestamp = new Date(entry.timestamp).toISOString()
	return `[${timestamp}][${entry.level.toUpperCase()}] ${entry.message}`
}

/**
 * Query backend console logs through the unified query contract
 * (newest-first, level + content filtered, field-projected, paginated).
 *
 * Returns the page of formatted log lines plus the unified pagination
 * envelope. This is the backend console's implementation of the shared
 * {@link QueryResult} interface.
 */
export function queryBackendLogs(
	allLogs: DiagnosticLog[],
	params: { level?: string; query?: string; limit?: number; cursor?: number; fields?: string } = {},
): QueryResult {
	const level = params.level
	const query = params.query
	const limit = clampLimit(params.limit)
	const cursor = params.cursor && params.cursor > 0 ? params.cursor : 0
	const fields = parseFields(params.fields)

	let filtered = allLogs
	if (level) {
		filtered = filtered.filter((e) => e.level === level)
	}
	if (query) {
		const q = query.toLowerCase()
		filtered = filtered.filter((e) => e.message.toLowerCase().includes(q))
	}

	// Newest-first, then field-project to the raw log records.
	const records = [...filtered].reverse().map(
		(e) =>
			({
				timestamp: e.timestamp,
				level: e.level,
				message: e.message,
			}) as QueryItem,
	)

	const projected = projectFields(records, fields)
	const total = projected.length
	const start = cursor
	const end = start + limit
	const page = projected.slice(start, end)

	return {
		items: page,
		total,
		cursor: end,
		hasMore: end < total,
	}
}

/**
 * Render a page of log records as the public `[timestamp][LEVEL] message`
 * line strings. Keeps the line formatting in one place.
 */
export function renderLogLines(items: QueryItem[]): string[] {
	return items.map(
		(record) =>
			`[${new Date(record.timestamp as number).toISOString()}][${String(record.level).toUpperCase()}] ${record.message}`,
	)
}

/**
 * Return the last `count` entries of `items`, in reverse order (newest first).
 * Shared pagination tail used by `filterBackendLogs` and `getLogs`.
 */
export function tailReversed<T>(items: T[], count: number): T[] {
	const endIndex = items.length
	const startIndex = Math.max(0, endIndex - count)
	return items.slice(startIndex, endIndex).reverse()
}
