/**
 * Infinite Context Graph Storage - bounded context window store (ICG-C1).
 *
 * Registered as the 10th backend root-store key (`context`). Holds ONLY minimal per-task metadata
 * for hydrated-state consumers (vscode webview + server hello->state), never message content:
 * full history stays on disk under `<storageDir>/context/` and arrives via explicit range/recall
 * fetches after the handshake - the bounded-handshake decision of ICG doc section 7.3.
 */

import { types } from "mobx-state-tree"

/** Bounded per-task context metadata (ICG doc section 7.3 minimal group). */
export const ContextTaskMeta = types.model("ContextTaskMeta", {
	/** Total archived message count for the task (`SELECT COUNT(*)` over `context_messages`). O(1) index read at push time. */
	totalSeqCount: types.number,
	/** Seq where the uncompressed (fresh tail / working set) portion starts; with no rollup nodes yet in ICG-C1 this is min(seq). */
	freshTailFromSeq: types.optional(types.number, 0),
})

export type IContextTaskMeta = typeof ContextTaskMeta.Type

/** Root-level context window store - bounded by design (section 7.3 decision table rejects full history / DAG skeleton in the snapshot for v1). */
export const ContextWindowModel = types
	.model("ContextWindow", {
		/** taskId -> bounded metadata; content never lives here (P3: RAM holds only what can be sent to a model + its metadata, section 5.4). */
		tasks: types.map(ContextTaskMeta),
	})

	.actions((self) => ({
		setTaskMeta(taskId: string, totalSeqCount: number, freshTailFromSeq = 0): void {
			self.tasks.set(taskId, ContextTaskMeta.create({ totalSeqCount, freshTailFromSeq }))
		},
	}))

export type IContextWindowModel = typeof ContextWindowModel.Type

/** Default factory for the root-store `context` key (additive registration in backendroot/store.ts). */
export function createContextWindowState(): { tasks: Record<string, never> } {
	return { tasks: {} }
}
