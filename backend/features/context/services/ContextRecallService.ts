// ICG-C2 chunked recall / history-range read surface over the lossless context archive built and owned by ContextArchiveService (ICG-C1). This module owns both streaming exception pattern delivery helpers per spec sections 7.2/8.2 - resolveHistorySpan turns a HistoryRangeRequest into one clamped window (raw-window geometry lives in ./history-window), fetchHistoryPage reads one page of verbatim items from that window - and the recall read path itself: head/tail token-budget fit (section 6.4) plus the public recallRange entry point (locator resolution delegated to ./history-window) so tool-path and service-direct recall share one implementation by construction (R3 parity). Pure Node service: no vscode imports; every function takes the single open SqlDatabase as a parameter instead of opening its own connection, except recallRange which resolves it via getContextDatabase() like the rest of the read surface.

import type {
	HistoryChunkItem,
	HistoryRangeRequest,
	RecallItem,
	RecallRequest,
	RecallResponse,
} from "@jabberwock/types"

import { getContextDatabase } from "./ContextArchiveService"
import { findCoveringNodeMeta, getTaskStats, normalizeRoleValue, resolveRecallBudget } from "./ContextSearchService"
import { clampHistoryWindow, resolveRawHistoryWindow, resolveRecallTarget } from "./history-window"
import type { SqlDatabase } from "./driver"

/** Chunked history-range delivery defaults (streaming exception pattern, section 6.3). */
export const HISTORY_PAGE_SIZE_DEFAULT = 10
export const HISTORY_PAGE_SIZE_MAX = 20

export interface HistorySpan {
	loSeq: number
	hiSeq: number
	direction: "up" | "down" // page order only; the span itself is always stored lo..hi [D-history-span-normalized].
	pageSize: number
}

function clampHistoryPageSize(pageSize?: number): number {
	if (typeof pageSize !== "number" || !Number.isFinite(pageSize)) return HISTORY_PAGE_SIZE_DEFAULT
	return Math.min(Math.max(Math.floor(pageSize), 1), HISTORY_PAGE_SIZE_MAX)
}

/** Resolve a history-range request into one delivery window per section 6.2/6.3 (D-history-window-resolution): an explicit from/to pair wins over anchor+direction, which in turn beats one-sided bounds; everything is clamped into the task's [min,max] and null when nothing remains after clamping or no locator was supplied at all. */
export function resolveHistorySpan(
	db: SqlDatabase,
	request: HistoryRangeRequest,
): { span: HistorySpan; stats: NonNullable<ReturnType<typeof getTaskStats>> } | null {
	const taskId = typeof request.taskId === "string" ? request.taskId : ""
	if (taskId.length === 0) return null

	const stats = getTaskStats(db, taskId)
	if (!stats || stats.minSeq === null || stats.maxSeq === null) return null // unknown or empty task.

	const rawWindow = resolveRawHistoryWindow(request, stats.minSeq, stats.maxSeq)
	if (rawWindow === null) return null // no usable window for this request.

	const clamped = clampHistoryWindow(rawWindow.lo, rawWindow.hi, stats.minSeq, stats.maxSeq)
	if (clamped === null) return null // empty span after clamping [D-history-empty-span].

	return {
		span: {
			loSeq: clamped.lo,
			hiSeq: clamped.hi,
			direction: request.direction ?? "down",
			pageSize: clampHistoryPageSize(request.pageSize),
		},
		stats,
	}
}

/** Fetch one delivery chunk within a resolved span [D-history-page-order]: direction down pages ascending from loSeq, up pages descending from hiSeq; omit afterSeq for the first page. Each item carries its verbatim partsJson plus the covering node id when present (summaryText and per-item nodeMeta stay unset in C2 - D-history-summary-text-unset). */
export function fetchHistoryPage(
	db: SqlDatabase,
	taskId: string,
	span: HistorySpan,
	afterSeq?: number,
): { items: HistoryChunkItem[]; lastSeq: number | null } {
	const nodes = db
		.prepare(
			"SELECT node_id AS nodeId, from_seq AS lo, to_seq AS hi FROM context_nodes WHERE task_id = ? AND from_seq <= ? AND to_seq >= ?",
		)
		.all<{ nodeId: string | null; lo: number | null; hi: number | null }>(taskId, span.hiSeq, span.loSeq) // all nodes overlapping the whole span in one query [D-history-node-coverage-batch].
	const coveringNodeId = (seq: number): string | undefined => {
		for (const node of nodes) {
			if (node.nodeId === null) continue // non-node rows carry no locator.

			const lo = Number(node.lo)
			const hi = Number(node.hi)

			if (lo <= seq && seq <= hi) return String(node.nodeId) // shallowest wins because the query result order is not guaranteed - first overlap suffices for C2 where rollups are absent.
		}

		return undefined
	}

	let sql: string
	const params: unknown[] = [taskId]
	if (span.direction === "down") {
		sql =
			afterSeq === undefined
				? "SELECT seq, role, content_json AS partsJson FROM context_messages WHERE task_id = ? AND seq >= ? ORDER BY seq ASC LIMIT ?"
				: "SELECT seq, role, content_json AS partsJson FROM context_messages WHERE task_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?"
		params.push(afterSeq === undefined ? span.loSeq : afterSeq)
	} else {
		sql =
			afterSeq === undefined
				? "SELECT seq, role, content_json AS partsJson FROM context_messages WHERE task_id = ? AND seq <= ? ORDER BY seq DESC LIMIT ?"
				: "SELECT seq, role, content_json AS partsJson FROM context_messages WHERE task_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?"
		params.push(afterSeq === undefined ? span.hiSeq : afterSeq)
	}

	params.push(span.pageSize) // LIMIT placeholder - the page size applies to both directions [D-history-page-order].

	const rows = db.prepare(sql).all<{ seq: number; role: string | null; partsJson: string | null }>(...params)
	if (rows.length === 0) return { items: [], lastSeq: null }

	return {
		items: rows.map(
			(row): HistoryChunkItem => ({
				seq: row.seq,
				role: normalizeRoleValue(row.role),
				partsJson: row.partsJson === null ? "null" : row.partsJson, // content_json is NOT NULL per DDL; the fallback keeps a hypothetical NULL round-tripping as JSON.
				nodeId: coveringNodeId(row.seq),
			}),
		),
		lastSeq: rows[rows.length - 1]?.seq ?? null,
	}
}

const EMPTY_RECALL: RecallResponse = { items: [], truncatedFromMiddle: false }

function logWarn(message: string): void {
	console.warn(`[jabberwock] [context-recall] ${message}`)
}

function rowTokenCost(row: { tokens: number }): number {
	const value = Number(row.tokens)
	return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1 // ingest guarantees >= 1 (char/4 estimate); the floor keeps malformed rows from breaking budget math.
}

function toRecallItem(row: { seq: number; role: string | null; partsJson: string | null }): RecallItem {
	return {
		seq: row.seq,
		role: normalizeRoleValue(row.role),
		partsJson: row.partsJson === null ? "null" : row.partsJson,
	} // content_json is NOT NULL per DDL; the fallback keeps a hypothetical NULL round-tripping as JSON.
}

function fitItemsToBudget(
	rows: Array<{ seq: number; role: string | null; partsJson: string | null; tokens: number }>,
	budget: number,
): { items: RecallItem[]; truncatedFromMiddle: boolean } {
	const total = rows.reduce((sum, row) => sum + rowTokenCost(row), 0)
	if (total <= budget || rows.length === 0) return { items: rows.map(toRecallItem), truncatedFromMiddle: false }

	// Head-first fill, then append from the tail while the combined total still fits; everything in between is dropped. The first row always ships even when it alone exceeds the budget (one oversized message beats zero).
	const head: RecallItem[] = []
	let used = 0
	for (const row of rows) {
		const cost = rowTokenCost(row)
		if (head.length > 0 && used + cost > budget) break
		head.push(toRecallItem(row))
		used += cost
	}

	const tail: RecallItem[] = []
	for (let i = rows.length - 1; i >= head.length; i -= 1) {
		const row = rows[i]
		if (!row) continue
		const cost = rowTokenCost(row)
		if (tail.length > 0 && used + cost > budget) break
		tail.unshift(toRecallItem(row)) // unshift while walking downward keeps the tail in ascending seq order.
		used += cost
	}

	return { items: [...head, ...tail], truncatedFromMiddle: true }
}

/** Expand a node or message locator back into raw verbatim content per section 6.2 (RecallRequest). partsJson values are the stored content_json strings byte-for-byte including thinking blocks (section 6.4); when they exceed maxTokens the middle items are dropped and truncatedFromMiddle is set [D-recall-head-tail-fit]. */
export function recallRange(request: RecallRequest): RecallResponse {
	const db = getContextDatabase()
	if (!db) return EMPTY_RECALL // degraded mode - logged once by ContextArchiveService at initialization (section 5.6).

	const target = resolveRecallTarget(db, request)
	if (target === null) {
		logWarn(
			`recall skipped: unresolved locator ${JSON.stringify({ nodeId: typeof request.nodeId === "string" ? request.nodeId : null })}`,
		)
		return EMPTY_RECALL
	}

	const budget = resolveRecallBudget(request.maxTokens) // C2 has no live window source; explicit clamp inputs are honored when a caller supplies them.
	const rows = db
		.prepare(
			"SELECT m.seq AS seq, m.role AS role, m.content_json AS partsJson, m.token_count AS tokens FROM context_messages m WHERE task_id = ? AND seq BETWEEN ? AND ? ORDER BY seq",
		)
		.all<{
			seq: number
			role: string | null
			partsJson: string | null
			tokens: number
		}>(target.taskId, target.start, target.end)

	const { items, truncatedFromMiddle } = fitItemsToBudget(rows, budget)
	const response: RecallResponse = { items, truncatedFromMiddle }
	const nodeMeta = findCoveringNodeMeta(db, target.taskId, target.start, target.end) // optional field - undefined while ICG-C1 rollups are absent.
	if (nodeMeta !== null) response.nodeMeta = nodeMeta
	return response
}
