import { types, Instance } from "mobx-state-tree"

import type { HistoryChunkItem, HistoryCompleted, RecallItem } from "@jabberwock/types"

/**
 * ContextViewportStore — ICG-D1 (infinite-context display layer, spec §7).
 *
 * A STANDALONE MST model (NOT a root-store child) owned by the webview: it holds
 * the client's OWN viewport buffer of the full conversation history (bounded,
 * windowed) plus the bounded handshake metadata and jump-controls boundary info.
 *
 * Design constraints honoured (spec §7.1/§7.3/§8.2):
 *  - rows come from a local buffer keyed by `seq`; only the requested range is
 *    ever held in memory, so an arbitrarily large archive stays bounded client-side.
 *  - heavy content arrives as `context.history.chunk` frames (streaming exception
 *    pattern — these arrive on the connector bus, NOT through IntentBus/MST); this
 *    store is patched by the bus subscription in `store-singleton.ts`.
 *  - the handshake metadata group is bounded by design (§7.3): totalSeqCount +
 *    freshTailFromSeq per task, never the full history.
 *  - virtualization state (scrollTop/viewportHeight) lives here so the Timeline is
 *    a dependency-free windowed list (no external virtualizer dependency).
 *
 * It is consumed via a `mobx-react-lite` `observer` component (see
 * `components/timeline.tsx`) and driven by the action creators in `actions.ts`,
 * which publish over `IConnectorEventBus` only (zero postMessage in app-level code).
 */
export const ContextViewportStore = types
	.model("ContextViewportStore", {
		/** The task whose history the viewport currently displays. */
		currentTaskId: types.optional(types.string, ""),
		/** Bounded per-task archive metadata (spec §7.3) — seeded from the hydrated `state` frame. */
		taskMeta: types.map(
			types.model("ContextTaskMeta", {
				totalSeqCount: types.number,
				freshTailFromSeq: types.optional(types.number, 0),
			}),
		),
		/** Viewport buffer: `String(seq)` → one chunk item (spec §7.1 rows). Frozen so MST never deep-tracks page payloads. */
		items: types.map(types.frozen<HistoryChunkItem>()),
		/** Boundary metadata per task (spec §5.3/§7.4) — drives the jump controls. Keyed by taskId. */
		bounds: types.map(
			types.model("ContextRangeBounds", {
				minSeq: types.number,
				maxSeq: types.number,
				totalCount: types.number,
				approxMidpoint: types.number,
				truncatedFromMiddle: types.optional(types.boolean, false),
			}),
		),
		/** Expanded rollup / thinking node ids (spec §7.5). `true` = expanded. */
		expandedNodes: types.map(types.literal(true)),
		/** Raw (lossless) items fetched via `context.recall.response` for an expanded node, keyed by nodeId. */
		recalledItems: types.map(types.frozen<RecallItem[]>()),
		/** Virtualization window state (dependency-free windowed list). */
		scrollTop: types.optional(types.number, 0),
		viewportHeight: types.optional(types.number, 600),
	})
	.actions((self) => ({
		// ── Data setters (driven by the bus subscription) ──────────────────
		setCurrentTask(taskId: string) {
			if (self.currentTaskId === taskId) return
			self.currentTaskId = taskId
			// Switching tasks invalidates the viewport buffer and expansion state.
			self.items.clear()
			self.bounds.delete(taskId)
			self.expandedNodes.clear()
			self.recalledItems.clear()
			self.scrollTop = 0
		},
		/** Seed/refresh bounded metadata for one task (spec §7.3). */
		seedTaskMeta(taskId: string, totalSeqCount: number, freshTailFromSeq = 0) {
			self.taskMeta.set(taskId, { totalSeqCount, freshTailFromSeq })
		},
		/** Apply one chunk page: upsert each item by seq (idempotent — spec §8.2). */
		applyChunk(items: HistoryChunkItem[]) {
			for (const item of items) {
				self.items.set(String(item.seq), item)
			}
		},
		/** Record boundary metadata from the terminal `completed` frame (spec §5.3/§7.4). */
		applyCompleted(taskId: string, completed: HistoryCompleted) {
			self.bounds.set(taskId, {
				minSeq: completed.minSeq,
				maxSeq: completed.maxSeq,
				totalCount: completed.totalCount,
				approxMidpoint: completed.approxMidpoint,
				truncatedFromMiddle: completed.truncatedFromMiddle ?? false,
			})
		},
		/** Cache lossless raw items for an expanded node (spec §7.5 recall path). */
		setRecalled(nodeId: string, items: RecallItem[]) {
			self.recalledItems.set(nodeId, items)
		},
		toggleNode(nodeId: string) {
			if (self.expandedNodes.has(nodeId)) {
				self.expandedNodes.delete(nodeId)
			} else {
				self.expandedNodes.set(nodeId, true)
			}
		},
		// ── Virtualization window ──────────────────────────────────────────
		setScroll(top: number, height: number) {
			self.scrollTop = top
			if (height > 0) {
				self.viewportHeight = height
			}
		},
	}))
	.views((self) => ({
		/** Loaded seqs in ascending order (the virtualized row order). */
		get sortedSeqs(): number[] {
			return Array.from(self.items.keys())
				.map(Number)
				.filter((n) => Number.isFinite(n))
				.sort((a, b) => a - b)
		},
		get hasBounds(): boolean {
			return self.currentTaskId !== "" && self.bounds.has(self.currentTaskId)
		},
	}))

export type IContextViewportStore = Instance<typeof ContextViewportStore>
