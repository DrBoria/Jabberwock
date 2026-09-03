// ICG-C2 span/window + recall-locator resolution over the context archive (read path, sections 6.2/6.3/8.2): turns a HistoryRangeRequest into one clamped delivery window and a RecallRequest into a concrete (task, seq span) - the shared geometry that ContextRecallService's resolveHistorySpan and recallRange both lean on. Sibling module of ContextRecallService so both stay within their line budgets. Pure Node - no vscode imports; every function takes the single open SqlDatabase as a parameter or is pure arithmetic.

import type { HistoryRangeRequest, RecallRequest } from "@jabberwock/types"

import { finiteIntOrZero } from "./ContextSearchService"
import type { SqlDatabase } from "./driver"

/** True when a value is a finite JS number; the protocol fields are optional so every bound check funnels through this helper. */
function isFiniteNumber(value?: unknown): boolean {
	return typeof value === "number" && Number.isFinite(value)
}

interface RawHistoryWindow {
	lo: number
	hi: number
}

/** An explicit from/to pair wins over anchor+direction (D-history-explicit-span-wins); inverted bounds are normalized to lo..hi. */
function spanFromExplicitBounds(fromSeq: number, toSeq: number): RawHistoryWindow {
	return { lo: Math.min(fromSeq, toSeq), hi: Math.max(fromSeq, toSeq) }
}

/** Walk backward from the anchor when direction is up; default direction is forward (D-history-anchor-default-down). */
function spanFromAnchor(anchor: number, minSeq: number, maxSeq: number, direction?: "up" | "down"): RawHistoryWindow {
	const upward = direction === "up"
	return upward ? { lo: minSeq, hi: anchor } : { lo: anchor, hi: maxSeq }
}

/** A lone fromSeq means forward to task max; a lone toSeq walks back from task min (D-history-one-sided). */
function spanFromOneSided(
	hasFrom: boolean,
	fromSeq: number,
	toSeq: number,
	minSeq: number,
	maxSeq: number,
): RawHistoryWindow {
	return hasFrom ? { lo: fromSeq, hi: maxSeq } : { lo: minSeq, hi: toSeq }
}

/** Resolve the raw window a HistoryRangeRequest asks for before clamping: an explicit from/to pair wins over anchor+direction, which in turn beats one-sided bounds; null when no locator was supplied at all (D-history-window-resolution). */
export function resolveRawHistoryWindow(
	request: HistoryRangeRequest,
	minSeq: number,
	maxSeq: number,
): RawHistoryWindow | null {
	const hasFrom = isFiniteNumber(request.fromSeq)
	const hasTo = isFiniteNumber(request.toSeq)

	if (hasFrom && hasTo) {
		const from = finiteIntOrZero(request.fromSeq)
		const to = finiteIntOrZero(request.toSeq)

		return spanFromExplicitBounds(from, to) // explicit pair wins over anchor and one-sided bounds [D-history-explicit-span-wins].
	}
	if (isFiniteNumber(request.anchorSeq)) {
		return spanFromAnchor(finiteIntOrZero(request.anchorSeq), minSeq, maxSeq, request.direction)
	}

	const hasOneSided = hasFrom || hasTo
	if (!hasOneSided) return null // no locator at all - unresolved rather than dumping the whole task.
	return spanFromOneSided(hasFrom, finiteIntOrZero(request.fromSeq), finiteIntOrZero(request.toSeq), minSeq, maxSeq)
}

/** Clamp a raw window into the task's [minSeq, maxSeq]; null when nothing remains after clamping (D-history-empty-span). */
export function clampHistoryWindow(lo: number, hi: number, minSeq: number, maxSeq: number): RawHistoryWindow | null {
	const clampedLo = Math.max(minSeq, lo)
	const clampedHi = Math.min(maxSeq, hi)

	return clampedLo > clampedHi ? null : { lo: clampedLo, hi: clampedHi }
}

interface ResolvedRecallTarget {
	taskId: string
	start: number
	end: number
}

/** Node-row branch of locator resolution per D-recall-locators-required: one context_nodes lookup by node_id; null when the row is absent, its task id is not a string, or either bound fails to convert (Number() semantics on stored values are preserved exactly). */
function resolveNodeRowSpan(db: SqlDatabase, nodeId: string): ResolvedRecallTarget | null {
	const nodeRow = db
		.prepare("SELECT task_id AS taskId, from_seq AS fromSeq, to_seq AS toSeq FROM context_nodes WHERE node_id = ?")
		.get<{ taskId: string | null; fromSeq: number | null; toSeq: number | null }>(nodeId)
	if (nodeRow === undefined || typeof nodeRow.taskId !== "string") return null

	const start = Number(nodeRow.fromSeq)
	const end = Number(nodeRow.toSeq)
	if (!Number.isFinite(start) || !Number.isFinite(end)) return null // both bounds must convert to finite numbers - identical acceptance set as the original nested guard.

	return { taskId: nodeRow.taskId, start, end }
}

/** Resolve the concrete (task, seq span) a RecallRequest points at per D-recall-locators-required: msg:<taskId>:<seq> ids first, then context_nodes rows by node_id; explicit fromSeq/toSeq clamp inside the resolved span. Returns null when no locator resolves - bare sequence ranges without an anchor are rejected rather than guessed across tasks because RecallRequest carries no taskId field (section 6.2). */
export function resolveRecallTarget(db: SqlDatabase, request: RecallRequest): ResolvedRecallTarget | null {
	const nodeId = typeof request.nodeId === "string" ? request.nodeId : ""

	if (nodeId.length > 0) {
		const msgMatch = /^msg:(.+):(\d+)$/.exec(nodeId) // greedy task id allows ids containing colons; seq is the final numeric segment.
		if (msgMatch !== null) {
			const msgSeq = Number(msgMatch[2]) // a message locator spans exactly its own sequence [D-recall-locators-required].

			return applyRecallClamp(msgMatch[1], msgSeq, msgSeq, request.fromSeq, request.toSeq)
		}

		const nodeTarget = resolveNodeRowSpan(db, nodeId)
		if (nodeTarget !== null) {
			return applyRecallClamp(nodeTarget.taskId, nodeTarget.start, nodeTarget.end, request.fromSeq, request.toSeq)
		}
	}

	return null // no resolvable anchor - bare seq ranges are rejected by design.
}

/** Clamp an explicit fromSeq/toSeq pair inside a resolved span and pack the result with its task id; empty spans after clamping stay unresolved [D-recall-empty-span]. */
function applyRecallClamp(
	taskId: string,
	start: number,
	end: number,
	from?: unknown,
	to?: unknown,
): ResolvedRecallTarget | null {
	const clamped = clampRangeSpan(start, end, from, to)

	return clamped === null ? null : { taskId, start: clamped.start, end: clamped.end }
}

function clampRangeSpan(
	start: number,
	end: number,
	from?: unknown,
	to?: unknown,
): { start: number; end: number } | null {
	let s = Math.min(Math.floor(start), Math.floor(end)) // tolerate inverted node bounds defensively.
	let e = Math.max(Math.floor(start), Math.floor(end))
	if (typeof from === "number" && Number.isFinite(from)) s = Math.max(s, Math.floor(from))
	if (typeof to === "number" && Number.isFinite(to)) e = Math.min(e, Math.floor(to))

	return s <= e ? { start: s, end: e } : null // empty span after clamping is unresolved [D-recall-empty-span].
}
