import { ContextViewportStore } from "./store"
import { requestHistoryRange } from "./actions"
import type { DisposableLike, HistoryChunkItem, InboundAppMessage, RecallItem } from "@jabberwock/types"
import { contextEventNames } from "@jabberwock/types"
import { getConnectorBus } from "../../connector-bus"

/** The one and only context viewport store instance (webview-owned, ICG-D1). */
export const contextViewportStore = ContextViewportStore.create()

/**
 * Narrow an inbound `task.state.received` message to its ICG-C1 task meta (a
 * `Record<taskId, {totalSeqCount, freshTailFromSeq}>` seeded by the backend's
 * `enrichContextMeta` into the hydrated `state` frame), if present.
 */
function extractTaskMeta(
	msg: InboundAppMessage,
): Array<[string, { totalSeqCount: number; freshTailFromSeq?: number }]> {
	const state = msg.state as
		| { context?: { tasks?: Record<string, { totalSeqCount?: number; freshTailFromSeq?: number }> } }
		| undefined
	const tasks = state?.context?.tasks
	if (!tasks || typeof tasks !== "object") return []
	const out: Array<[string, { totalSeqCount: number; freshTailFromSeq?: number }]> = []
	for (const [taskId, meta] of Object.entries(tasks)) {
		if (meta && typeof meta.totalSeqCount === "number") {
			out.push([taskId, { totalSeqCount: meta.totalSeqCount, freshTailFromSeq: meta.freshTailFromSeq }])
		}
	}
	return out
}

/**
 * Subscribe the context store to the connector bus inbound frames (ICG-D1, spec
 * §7.1/§8.2). Called from bootstrap AFTER `initConnectorBus()` resolves. Returns a
 * disposable so it can be torn down (tests / unmount).
 *
 * Frames handled:
 *  - `context.history.chunk`     → applyChunk (streaming exception path)
 *  - `context.history.completed` → applyCompleted (boundary metadata)
 *  - `context.recall.response`   → setRecalled (expanded raw content)
 *  - `state` (hydrated frame)    → seed bounded task meta from `state.context.tasks`
 *    (the backend's `enrichContextMeta` injects the ICG-C1 meta into the state)
 */
export function subscribeContextStore(): DisposableLike {
	const disposables: DisposableLike[] = []
	const bus = getConnectorBus()

	// `context.history.chunk` / `context.history.completed` are the streaming
	// frames from ICG-C2's history delivery path (deliberately not part of the
	// request/response `contextEventNames` set — they stream outside the request).
	disposables.push(
		bus.subscribe({ types: ["context.history.chunk"] }, (msg) => {
			if (msg.type !== "context.history.chunk") return
			// `msg` is the catch-all member here; `items` is `unknown` — validate, then cast the elements.
			const items = msg.items as HistoryChunkItem[] | undefined
			if (Array.isArray(items)) {
				contextViewportStore.applyChunk(items)
			}
		}),
		bus.subscribe({ types: ["context.history.completed"] }, (msg) => {
			if (msg.type !== "context.history.completed") return
			const taskId = msg.taskId as string | undefined
			const totalCount = msg.totalCount as number | undefined
			if (taskId && typeof totalCount === "number") {
				contextViewportStore.applyCompleted(taskId, {
					type: "context.history.completed",
					taskId,
					requestId: (msg.requestId as string | undefined) ?? "",
					minSeq: msg.minSeq as number,
					maxSeq: msg.maxSeq as number,
					totalCount,
					approxMidpoint: msg.approxMidpoint as number,
					truncatedFromMiddle: msg.truncatedFromMiddle as boolean | undefined,
				})
			}
		}),
		bus.subscribe({ types: [contextEventNames.recallResponse] }, (msg) => {
			if (msg.type !== contextEventNames.recallResponse) return
			// Recall responses are targeted (no requestId); the node id from the
			// node meta is the stable anchor for expansion state.
			const items = msg.items as RecallItem[] | undefined
			const nodeMeta = msg.nodeMeta as { nodeId?: string } | undefined
			const nodeId = nodeMeta?.nodeId
			if (Array.isArray(items) && nodeId) {
				contextViewportStore.setRecalled(nodeId, items)
			}
		}),
		bus.subscribe({ types: ["state"] }, (msg) => {
			const tasks = extractTaskMeta(msg)
			if (tasks.length === 0) return
			for (const [taskId, meta] of tasks) {
				contextViewportStore.seedTaskMeta(taskId, meta.totalSeqCount, meta.freshTailFromSeq ?? 0)
			}
		}),
	)

	return {
		dispose() {
			for (const d of disposables) d.dispose()
		},
	}
}

/**
 * Kick off an anchored initial viewport fetch for a task (beginning by default).
 * Called from the Timeline when it opens on a task or resolves a deep-link.
 */
export function requestTaskHistory(taskId: string, anchorSeq?: number): void {
	contextViewportStore.setCurrentTask(taskId)
	const meta = contextViewportStore.taskMeta.get(taskId)
	const bounds = contextViewportStore.bounds.get(taskId)
	// Default: page around the fresh tail (most recent) unless a deep-link anchor was given.
	const anchor = anchorSeq ?? meta?.freshTailFromSeq ?? bounds?.maxSeq
	if (anchor === undefined) return
	requestViewportRange(taskId, anchor, 50)
}

/**
 * Fetch a window of the history centred on `anchorSeq` (virtualizer on-demand /
 * jump-controls). `fromSeq`/`toSeq` are the explicit range (wins over the anchor
 * on the backend, spec §7.2); the `requestId` makes duplicate in-flight fetches
 * idempotent (spec §8.2).
 */
export function requestViewportRange(taskId: string, anchorSeq: number, pageSize = 50): void {
	const half = Math.floor(pageSize / 2)
	requestHistoryRange({
		taskId,
		requestId: `view-${taskId}-${anchorSeq}`,
		anchorSeq,
		fromSeq: Math.max(1, anchorSeq - half),
		toSeq: anchorSeq + half,
		pageSize,
	})
}
