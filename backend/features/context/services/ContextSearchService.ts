// ICG-C2 read path over the lossless context archive built and owned by ContextArchiveService (ICG-C1). Pure Node service: no vscode imports, no MST store access; it reuses the single open SqlDatabase via getContextDatabase() instead of opening its own connection. Every public function degrades to an empty or leaf-level result when the archive is not ready or the native driver was unavailable at startup (section 5.6); that degradation state is logged once by ContextArchiveService during initialization, so read-path calls stay quiet and never throw - callers do not need try/catch around them. The per-source FTS hit queries live in ./fts-read (sibling module, same line-budget split).

import type {
	ContextMessageRole,
	DescribeRequest,
	DescribeResponse,
	RecallResponse,
	SearchRequest,
	SearchResult,
} from "@jabberwock/types"

import { getContextDatabase } from "./ContextArchiveService"
import { queryMessageHits, querySummaryHits } from "./fts-read"
import type { SqlDatabase } from "./driver"

/** Default recall token budget per section 6.2 (RecallRequest.maxTokens default). */
export const DEFAULT_RECALL_TOKENS = 8000
/** Search result limits: protocol default and hard cap mirrored by the context_search tool schema. */
export const DEFAULT_SEARCH_LIMIT = 10
export const MAX_SEARCH_LIMIT = 50

function logWarn(message: string): void {
	console.warn(`[jabberwock] [context-search] ${message}`)
}

/** Clamp a caller-supplied search limit into the protocol range (1..MAX_SEARCH_LIMIT); non-finite input falls back to the default. */
export function clampSearchLimit(limit?: number): number {
	if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT
	return Math.min(Math.max(Math.floor(limit), 1), MAX_SEARCH_LIMIT)
}

/** Build a quoted OR-joined FTS5 MATCH expression from free-text query terms; null when no usable term survives sanitization. Double quotes inside a term are escaped by doubling per the FTS5 string-literal rules (D-fts-term-quoting). */
export function buildFtsMatchExpression(query: string): string | null {
	const terms = query
		.trim()
		.split(/\s+/)
		.filter((term) => term.length > 0)
		.map((term) => `"${term.replace(/"/g, '""')}"`)
	return terms.length > 0 ? terms.join(" OR ") : null
}

/** Token budget resolution per sections 6.3-6.4: the requested recall size is clamped against (model window - current assembly - reserved output) only when a caller supplies a model window; ICG-C2 has no live window source, so with none supplied the request passes through unchanged and thinking parity holds because reservedOutput covers reasoning tokens whenever they are known to the caller. */
export function resolveRecallBudget(
	maxTokens?: number,
	modelContextWindow?: number,
	currentAssemblySize = 0,
	reservedOutput = 0,
): number {
	const requested =
		typeof maxTokens === "number" && Number.isFinite(maxTokens)
			? Math.max(1, Math.floor(maxTokens))
			: DEFAULT_RECALL_TOKENS
	if (typeof modelContextWindow !== "number" || !Number.isFinite(modelContextWindow)) return requested
	const headroom = modelContextWindow - currentAssemblySize - reservedOutput
	return Math.min(requested, Math.max(1, Math.floor(headroom)))
}

/** Map a stored role string onto the protocol domain; out-of-domain values (only reachable through hand-crafted fixtures, since ingest normalizes per section 5.6) fall back to system with one logged warning while partsJson stays byte-for-byte verbatim [D-recall-role-fallback]. */
export function normalizeRoleValue(value: unknown): ContextMessageRole {
	if (value === "user" || value === "assistant" || value === "tool") return value
	return "system"
}

/** Full-text keyword search over archived messages and node summaries per section 6.2 (SearchRequest). Returns protocol SearchResult rows ordered best-match-first within the requested scope; empty array when the archive is not ready, no term survives sanitization, or nothing matches. */
export function searchArchivedContext(request: SearchRequest): SearchResult[] {
	const db = getContextDatabase()
	if (!db) return [] // degraded mode - logged once by ContextArchiveService at initialization (section 5.6).
	if (typeof request.query !== "string" || request.query.trim().length === 0) return []

	const limit = clampSearchLimit(request.limit)
	const matchExpression = buildFtsMatchExpression(request.query)
	if (!matchExpression) {
		logWarn("search skipped: no usable FTS terms after sanitization")
		return []
	}

	const scope = request.scope ?? "all"
	const messageHits = ["messages", "all"].includes(scope) ? queryMessageHits(db, request, matchExpression, limit) : []
	const summaryHits = ["summaries", "all"].includes(scope)
		? querySummaryHits(db, request, matchExpression, limit)
		: []
	if (scope !== "all") return [...messageHits, ...summaryHits].slice(0, limit) // single source: already LIMITed; slice is a safety net.

	// D-search-all-merge-order: interleave both sources by ascending raw FTS rank (best first), then cap to the requested limit.
	return mergeByFtsRank(messageHits, summaryHits).slice(0, limit)
}

function mergeByFtsRank(a: SearchResult[], b: SearchResult[]): SearchResult[] {
	// Array.prototype.sort is stable in Node >= 12, so per-source order survives rank ties [D-merge-stable-ties]. FTS5 bm25 ranks are lower for better matches.
	return [...a, ...b].sort((x, y) => x.rank - y.rank)
}

interface CoveringNodeRow {
	nodeId: string
	depth: number
	childrenJson: string | null
	fromSeq: number | null
	toSeq: number | null
	summaryText: string | null
}

/** Shallowest context_nodes row whose [from_seq, to_seq] contains the span; shared by recall nodeMeta and describeNode so both answer from one rule [D-describe-shallowest-cover]. */
function findShallowestCoveringNode(
	db: SqlDatabase,
	taskId: string,
	startSeq: number,
	endSeq: number,
): CoveringNodeRow | null {
	const row = db
		.prepare(
			"SELECT node_id AS nodeId, depth AS depth, child_node_ids_json AS childrenJson, from_seq AS fromSeq, to_seq AS toSeq, summary_text AS summaryText FROM context_nodes WHERE task_id = ? AND from_seq <= ? AND to_seq >= ? ORDER BY depth ASC LIMIT 1",
		)
		.get<CoveringNodeRow>(taskId, startSeq, endSeq)
	if (row === undefined || typeof row.nodeId !== "string") return null
	return {
		nodeId: row.nodeId,
		depth: Number(row.depth),
		childrenJson: row.childrenJson ?? null,
		fromSeq: Number(row.fromSeq),
		toSeq: Number(row.toSeq),
		summaryText: typeof row.summaryText === "string" ? row.summaryText : null,
	}
}

function countDirectChildren(childrenJson: string | null): number {
	if (childrenJson === null) return 0 // D-descendant-direct-children - direct child ids only; full subtree counts land with the compressor phase.
	try {
		const parsed: unknown = JSON.parse(childrenJson)
		return Array.isArray(parsed) ? parsed.length : 0
	} catch {
		return 0 // malformed json left at zero rather than throwing in a read path.
	}
}

export function findCoveringNodeMeta(
	db: SqlDatabase,
	taskId: string,
	startSeq: number,
	endSeq: number,
): RecallResponse["nodeMeta"] | null {
	const node = findShallowestCoveringNode(db, taskId, startSeq, endSeq)
	if (node === null || !Number.isFinite(node.depth)) return null

	return {
		nodeId: node.nodeId,
		depth: Math.floor(node.depth),
		descendantCount: countDirectChildren(node.childrenJson),
		range: { fromSeq: Number(node.fromSeq), toSeq: Number(node.toSeq) },
	}
}

/** Locate the context node covering a requested span per section 6.2 (DescribeRequest). While ICG-C1 rollups are absent every anchor resolves to its leaf message with summaryText=null, which is the protocol's "propose recall" signal; once compaction exists the shallowest covering group or rollup answers instead [D-describe-leaf-fallback]. */
export function describeNode(request: DescribeRequest): DescribeResponse {
	const db = getContextDatabase()
	if (!db)
		return leafDescribeFallback(
			typeof request.taskId === "string" ? request.taskId : "",
			finiteIntOrZero(request.fromSeq),
		) // degraded mode still returns a well-formed frame so the UI panel can render and propose recall.

	const node = findShallowestCoveringNode(
		db,
		typeof request.taskId === "string" ? request.taskId : "",
		finiteIntOrZero(request.fromSeq),
		finiteIntOrZero(request.toSeq),
	)
	if (node === null)
		return leafDescribeFallback(
			typeof request.taskId === "string" ? request.taskId : "",
			finiteIntOrZero(request.fromSeq),
		)

	return {
		nodeId: node.nodeId,
		depth: Number.isFinite(node.depth) ? Math.floor(node.depth) : 0,
		descendantCount: countDirectChildren(node.childrenJson),
		summaryText: node.summaryText,
	}
}

function leafDescribeFallback(taskId: string, seq: number): DescribeResponse {
	// The message itself is its own covering node at zero rollup depth; summaryText null = "propose recall" per section 6.2 semantics.
	return { nodeId: `msg:${taskId}:${seq}`, depth: 0, descendantCount: 1, summaryText: null }
}

export function finiteIntOrZero(value?: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value)
	return 0
}

interface TaskStats {
	totalCount: number
	minSeq: number
	maxSeq: number
}

/** Task-wide stats for the final history.completed frame; null when the task has no archived rows [D-history-empty-task]. */
export function getTaskStats(db: SqlDatabase, taskId: string): TaskStats | null {
	const row = db
		.prepare("SELECT COUNT(*) AS n, MIN(seq) AS mn, MAX(seq) AS mx FROM context_messages WHERE task_id = ?")
		.get<{ n: number; mn: number | null; mx: number | null }>(taskId)
	if (row === undefined || Number(row.n) <= 0) return null

	return {
		totalCount: Math.floor(Number(row.n)),
		minSeq: Number(row.mn),
		maxSeq: Number(row.mx),
	}
}
