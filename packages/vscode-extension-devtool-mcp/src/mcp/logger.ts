/**
 * Shared logger — the single logging file for the whole package.
 *
 * A bounded ring buffer of timestamped records. Every domain (backend,
 * frontend, stores) and every transport writes lifecycle events here; the
 * `get_logs` and `get_diagnostics_snapshot` MCP tools read from here.
 *
 * Pure formatting/filtering helpers live in `utils/log.ts` — this file only
 * owns the buffer and its accessors.
 */

import type { DiagnosticLevel } from "../types.js"

/** A single record in the shared log ring buffer. */
export interface LogEntry {
	/** Epoch millis when the record was written. */
	timestamp: number
	/** Log level. */
	level: DiagnosticLevel
	/** Origin of the record (e.g. "interceptor", "ws", "http", "stdio", "dom"). */
	source: string
	/** Free-form message. */
	message: string
}

/** Filter options for {@link getLogs}. */
export interface LogFilter {
	/** Only include records with this source (exact match). */
	source?: string
	/** Only include records at this level or more severe (error > warn > info > debug). */
	level?: DiagnosticLevel
	/** Case-insensitive substring match on the message. */
	search?: string
	/** Max records to return (newest first). Default: 50. */
	limit?: number
	/** Skip this many most-recent records before applying `limit`. Default: 0. */
	cursor?: number
}

/** Maximum number of records kept in the ring buffer. */
const MAX_ENTRIES = 2_000

const entries: LogEntry[] = []

/**
 * Write a record to the shared log buffer.
 *
 * @param source - Origin tag (e.g. "interceptor", "ws", "stdio").
 * @param level - Severity of the record.
 * @param message - Free-form message body.
 */
export function log(source: string, level: DiagnosticLevel, message: string): void {
	entries.push({ timestamp: Date.now(), level, source, message })
	if (entries.length > MAX_ENTRIES) {
		entries.splice(0, entries.length - MAX_ENTRIES)
	}
}

/**
 * Read records from the shared log buffer.
 *
 * Returns records NEWEST FIRST (the agent expects the tail of the log to be
 * the most recent activity).
 */
export function getLogs(filter: LogFilter = {}): LogEntry[] {
	const { source, level, search, limit = 50, cursor = 0 } = filter

	let result = entries
	if (source) {
		result = result.filter((e) => e.source === source)
	}
	if (level) {
		const minRank = LEVEL_RANK[level]
		result = result.filter((e) => LEVEL_RANK[e.level] >= minRank)
	}
	if (search) {
		const needle = search.toLowerCase()
		result = result.filter((e) => e.message.toLowerCase().includes(needle))
	}

	const window = result.slice(0, Math.max(0, result.length - cursor))
	return window.slice(Math.max(0, window.length - limit)).reverse()
}

/**
 * Drop all records from the buffer.
 */
export function clear(): void {
	entries.length = 0
}

/** Severity ranking: higher = more severe. */
const LEVEL_RANK: Record<DiagnosticLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
}
