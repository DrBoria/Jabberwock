/**
 * Infinite Context Graph Storage - protocol types (ICG-C1).
 *
 * Additive file in the existing v4 B1 protocol folder; every body below rides the standard
 * `ConnectorEnvelope` unchanged (§6.2 of plans/architecture-infinite-context-graph-storage.md,
 * envelope-consistent per v4 §4.1). Event constants follow the verified naming family
 * (`domain.action.state`) and cover the ICG-C1 registration table (§8.1) plus kept broadcasts.
 */

/** Node taxonomy (ICG doc §4.1 / LCM spec §4.3, kept verbatim). */
export type NodeKind = "message" | "topic_group" | "rollup" | "task_embed"

/** Message roles archived in `context_messages.role` (LCM spec DDL comment: user|assistant|tool|system). */
export type ContextMessageRole = "user" | "assistant" | "tool" | "system"

/** Seq span of task messages covered by a node; THE lossless expansion address (§4.3/§4.4). */
export interface ContextNodeRange {
	fromSeq: number
	toSeq: number
}

/**
 * One recursive structure for context AND UI (ICG doc §4.1, kept from LCM spec §4.3):
 * a `ContextNode` DAG per task branch (+ subtask branches via `task_embed`).
 */
export interface ContextNode {
	/** ULID at ingest (message nodes); deterministic hash(content+range) for summary/rollup nodes - idempotency key across compression cycles (§4.3). */
	nodeId: string
	taskId: string
	kind: NodeKind
	/** 0 = message/leaf, 1+ = rollups/topic groups above parent depth. */
	depth: number
	/** Lineage up (UI tree + traceability). */
	parentIds: string[]
	/** ORDERED children - this ordering IS the active-context order for assembly (§4.5 contract). */
	childNodeIds: string[]
	range: ContextNodeRange
	/** tiktoken-class estimate; rollup = children sum + summary overhead. */
	tokenCount: number
	/** Metadata-only flag on the NODE row - archive rows are never touched (P1 append-only). */
	status: "active" | "collapsed"
	createdAt: number
}

/** Bounded metadata carried by search/recall results for drill-down targeting (§6.3). */
export interface ContextNodeMeta {
	nodeId: string
	depth: number
	descendantCount?: number
	range: ContextNodeRange
}

// ─────────────────────────── context.search (ICG doc §6.2, kept verbatim) ───────────────────────────

/** Keyword FTS5 BM25 over archive + summaries; filters as SQL WHERE (§6.1/§6.2). */
export interface SearchRequest {
	type: "context.search.requested"
	taskId?: string
	query: string
	scope?: "messages" | "summaries" | "all"
	roleFilter?: ContextMessageRole[]
	/** Default 10 (§6.3 snippet bound). */
	limit?: number
}

export interface SearchResult {
	nodeId: string
	kind: NodeKind
	snippet: string
	rank: number
	range: ContextNodeRange
	taskId: string
}

export interface SearchResponse {
	results: SearchResult[]
}

// ─────────────────────────── context.recall (ICG doc §6.2, kept verbatim) ───────────────────────────

/** Expand a node/range back to RAW content - lossless, the S3 guarantee (§4.4/§6.4). */
export interface RecallRequest {
	type: "context.recall.requested"
	nodeId?: string
	fromSeq?: number
	toSeq?: number
	/** Default 8000; clamped service-side to remaining window space (§6.3 window clamp). */
	maxTokens?: number
}

export interface RecallItem {
	seq: number
	role: ContextMessageRole
	/** Verbatim structured parts INCLUDING thinking blocks - byte-for-byte parity with the original API payload (§6.4). */
	partsJson: string
}

export interface RecallResponse {
	items: RecallItem[]
	truncatedFromMiddle: boolean
	nodeMeta?: ContextNodeMeta
}

// ─────────────────────────── context.describe (ICG doc §6.2, kept verbatim) ───────────────────────────

/** Best-fit summary node for a range - drill-down targeting (§6.3). */
export interface DescribeRequest {
	type: "context.describe.requested"
	taskId: string
	fromSeq: number
	toSeq: number
}

export interface DescribeResponse {
	nodeId: string
	depth: number
	descendantCount: number
	/** null = no ready node -> propose recall. */
	summaryText: string | null
}

// ─────────────── context.history.range (ICG doc §7.2 display-layer messages, additive) ───────────────

/** FE->BE anchored viewport fetch; Normal intent (§8.1 NEW row). Explicit range wins over anchor. */
export interface HistoryRangeRequest {
	type: "context.history.range.requested"
	taskId: string
	/** Body-level correlation id for per-client targeted responses + idempotent dedup (§7.2/§8.2). */
	requestId: string
	anchorSeq?: number
	fromSeq?: number
	toSeq?: number
	pageSize?: number
	direction?: "up" | "down"
}

/** One item of a chunked range page (streaming exception pattern - bypasses IntentBus/MST, §7.1). */
export interface HistoryChunkItem {
	seq: number
	role: ContextMessageRole
	nodeId?: string
	partsJson?: string
	summaryText?: string
	nodeMeta?: ContextNodeMeta
}

/** BE->FE (requesting client only): chunk frame x 0..k, then completed (§7.2). */
export interface HistoryChunk {
	type: "context.history.chunk"
	taskId: string
	requestId: string
	chunkIndex: number
	items: HistoryChunkItem[]
}

/** BE->FE (requesting client only): terminal frame with boundary metadata for jump controls (§5.3/§7.4). */
export interface HistoryCompleted {
	type: "context.history.completed"
	taskId: string
	requestId: string
	minSeq: number
	maxSeq: number
	totalCount: number
	approxMidpoint: number
	truncatedFromMiddle?: boolean
}

/**
 * BE→FE ack frame delivered ONLY to the requesting client when a cancel (task.cancel.requested, Critical=0)
 * aborts an in-flight history-range/recall delivery (§8.2 [decision]: stop sending remaining chunks + ack).
 */
export interface HistoryCancelled {
	type: "context.history.cancelled"
	taskId: string
	requestId: string
}

// ─────────────────────────── event constants (ICG doc §8.1 registration table) ───────────────────────────

/**
 * All `context.*` event names for the infinite-context layer. Priority buckets per ICG doc §8.1:
 * compress.requested/window.evicted = Low(3); recall/search/describe.requested = High(1);
 * compress.completed/history.range.requested + broadcasts = Normal(2). Explicit registration in the
 * INTENT_PRIORITY maps is mandatory (unknown types default to Normal at the lookup site) - that
 * registration lands with ICG-C2; these constants are the shared vocabulary from C1.
 */
export const contextEventNames = {
	/** Low(3): GIVEN compressor trigger path (§4.5 contract). */
	compressRequested: "context.compress.requested",
	/** Normal(2): manifest swap + UI tree/timeline update broadcast (kept). */
	compressCompleted: "context.compress.completed",
	/** High(1): model waits on tool result in the turn-critical path (§8.1 R6 kept). */
	recallRequested: "context.recall.requested",
	/** High(1): same level as `tool.execution.required` - semantically it IS tool execution (kept). */
	searchRequested: "context.search.requested",
	/** High(1): drill-down targeting step of the sanctioned describe->recall two-step (§6.3, kept). */
	describeRequested: "context.describe.requested",
	/** Low(3): metadata-only eviction from MST - RAM hygiene (kept). */
	windowEvicted: "context.window.evicted",
	/** Normal(2) NEW: user-initiated viewport fetches must never block newer content or model recall (§8.1). */
	historyRangeRequested: "context.history.range.requested",
	/** Kept broadcast: incremental patches to already-loaded rows/nodes (§7.1/§7.5). */
	nodeUpdatedBroadcast: "context.node.updated.broadcast",
	/** Kept broadcast: active-window manifest swap notification (all clients converge, §8.2). */
	windowManifestChanged: "context.window.manifest.changed",
	/** Optional informational event: UI "collapsing..." indicator - non-blocking per R6 (§7.2 kept row). */
	compressProgress: "context.compress.progress",
	// ── ICG-C2 response/ack frame names (§6.2 request types above; frames are BE→FE only and never ride the IntentBus) ────────────────
	searchResponse: "context.search.response",
	recallResponse: "context.recall.response",
	describeResponse: "context.describe.response",
	/** Ack to the REQUESTING client only when a cancel (task.cancel.requested, Critical=0) aborts in-flight delivery (§8.2 [decision]). */
	historyCancelled: "context.history.cancelled",
} as const

export type ContextEventName = (typeof contextEventNames)[keyof typeof contextEventNames]
