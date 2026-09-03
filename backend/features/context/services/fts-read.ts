// ICG-C2 FTS hit queries over the lossless context archive (read path, section 6.2): message + summary full-text MATCH reads with JS-side excerpt building (snippet() is unusable in this build's SQLite 3.53.2 for fts5 tables [D-snippet-js-side]). Sibling read module of ContextSearchService so both stay within their line budgets: searchArchivedContext delegates the two per-source queries here and keeps scope/merge handling in ContextSearchService. Pure Node - no vscode imports; every function takes the single open SqlDatabase as a parameter.

import type { ContextMessageRole, NodeKind, SearchRequest, SearchResult } from "@jabberwock/types"

import { KNOWN_CONTEXT_ROLES } from "./ContextArchiveService"
import type { SqlDatabase } from "./driver"

const SNIPPET_MAX_CHARS = 160 // bounded excerpt per section 6.2 SearchResult.snippet semantics; full verbatim content stays reachable via recallRange [D-snippet-js-side].

function normalizeNodeKind(value: unknown): NodeKind | null {
	if (value === "message" || value === "topic_group" || value === "rollup" || value === "task_embed") return value
	return null
}

// Bounded single-line-safe excerpt for search results - truncates with an ellipsis marker when the source text exceeds the cap.
function boundSnippet(text: string): string {
	if (text.length <= SNIPPET_MAX_CHARS) return text
	return `${text.slice(0, SNIPPET_MAX_CHARS)}...`
}

// Flat display text of one stored partsJson value - mirrors the FTS trigger extraction for text and thinking blocks only; tool metadata is excluded from excerpts by design [D-snippet-js-side].
function flattenPartsText(partsJson: string): string {
	let parsed: unknown
	try {
		parsed = JSON.parse(partsJson)
	} catch {
		return "" // unparseable stored content yields an empty excerpt rather than a throw.
	}

	if (typeof parsed === "string") return parsed
	if (!Array.isArray(parsed)) return ""

	const pieces: string[] = []
	for (const block of parsed) {
		if (block === null || typeof block !== "object" || Array.isArray(block)) continue
		const record = block as Record<string, unknown> // narrow structural view - same cast pattern as the roleFilter guard above.
		if (typeof record.text === "string") pieces.push(record.text)
		if (typeof record.thinking === "string") pieces.push(record.thinking)
	}

	return pieces.join(" ")
}

/** Message-source FTS query: roleFilter is message-scoped per protocol semantics; out-of-domain roles are dropped silently because the protocol enum already constrains well-formed requests [D-rolefilter-unknown-dropped]. */
export function queryMessageHits(
	db: SqlDatabase,
	request: SearchRequest,
	matchExpression: string,
	limit: number,
): SearchResult[] {
	const params: unknown[] = [matchExpression]
	let sql =
		"SELECT m.task_id AS taskId, m.seq AS seq, m.content_json AS partsJson, messages_fts.rank FROM messages_fts JOIN context_messages m ON m.rowid = messages_fts.rowid WHERE messages_fts MATCH ?" // snippet() is unusable in this build's SQLite 3.53.2 for fts5 tables; the excerpt is derived from content_json in JS [D-snippet-js-side].
	if (typeof request.taskId === "string" && request.taskId.length > 0) {
		sql += " AND m.task_id = ?"
		params.push(request.taskId)
	}

	const roles: ContextMessageRole[] = []
	for (const role of Array.isArray(request.roleFilter) ? request.roleFilter : []) {
		if (!(KNOWN_CONTEXT_ROLES as readonly string[]).includes(role)) continue // out-of-domain values are dropped silently because the protocol enum already constrains well-formed requests [D-rolefilter-unknown-dropped].

		if (!roles.includes(role)) roles.push(role) // dedupe.
	}
	if (roles.length > 0) {
		sql += ` AND m.role IN (${roles.map(() => "?").join(", ")})`
		for (const role of roles) params.push(role)
	}

	sql += " ORDER BY rank LIMIT ?" // FTS5: lower rank value = better match, so ascending puts the best hits first [D-fts-rank-order].
	params.push(limit)

	const rows = db.prepare(sql).all<{ taskId: string; seq: number; partsJson: string | null; rank: number }>(...params)
	return rows.map(
		(row): SearchResult => ({
			nodeId: `msg:${row.taskId}:${row.seq}`, // D-msg-node-id-format - single-message locator understood by recallRange and the context_recall tool.
			kind: "message",
			snippet: boundSnippet(flattenPartsText(row.partsJson ?? "")),
			rank: row.rank,
			range: { fromSeq: row.seq, toSeq: row.seq },
			taskId: row.taskId,
		}),
	)
}

interface SummaryHitRow {
	nodeId: string
	taskId: string | null
	kind: unknown
	fromSeq: number | null
	toSeq: number | null
	snippetText: string | null
	rank: number
}

/** Summary-source FTS query over context_nodes: node summaries are not filtered by roleFilter (message-scoped semantics) [D-rolefilter-messages-only]; malformed node rows are skipped rather than fabricated into locators. */
export function querySummaryHits(
	db: SqlDatabase,
	request: SearchRequest,
	matchExpression: string,
	limit: number,
): SearchResult[] {
	const params: unknown[] = [matchExpression]
	let sql =
		"SELECT n.node_id AS nodeId, n.task_id AS taskId, n.kind AS kind, n.from_seq AS fromSeq, n.to_seq AS toSeq, n.summary_text AS snippetText, summaries_fts.rank FROM summaries_fts JOIN context_nodes n ON n.rowid = summaries_fts.rowid WHERE summaries_fts MATCH ?" // snippet() is unusable in this build's SQLite 3.53.2 for fts5 tables; the excerpt comes from summary_text directly [D-snippet-js-side].
	if (typeof request.taskId === "string" && request.taskId.length > 0) {
		sql += " AND n.task_id = ?"
		params.push(request.taskId)
	}

	sql += " ORDER BY rank LIMIT ?" // roleFilter is message-scoped per protocol semantics; node summaries are not filtered by it [D-rolefilter-messages-only].
	params.push(limit)

	const rows = db.prepare(sql).all<SummaryHitRow>(...params)
	return rows.flatMap((row): SearchResult[] => {
		const kind = normalizeNodeKind(row.kind)
		if (kind === null || typeof row.nodeId !== "string" || typeof row.taskId !== "string") return [] // malformed node row - skip rather than fabricate a locator.
		return [
			{
				nodeId: row.nodeId,
				kind,
				snippet: boundSnippet(row.snippetText ?? ""),
				rank: row.rank,
				range: { fromSeq: Number(row.fromSeq), toSeq: Number(row.toSeq) },
				taskId: row.taskId,
			},
		]
	})
}
