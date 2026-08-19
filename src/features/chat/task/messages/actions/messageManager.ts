import type { ITaskModel } from "@features/chat/task/store"

import { rewindToTimestamp as rewindToTimestampOp, rewindToIndex as rewindToIndexOp } from "./messageManager.ops"
import type { RewindOptions } from "./messageManager.history"

export type { RewindOptions }

/**
 * MessageManager provides centralized handling for all conversation rewind operations.
 *
 * This ensures that whenever UI chat history is rewound (delete, edit, checkpoint restore, etc.),
 * the API conversation history is properly maintained, including:
 * - Removing orphaned Summary messages when their condense_context is removed
 * - Removing orphaned truncation markers when their sliding_window_truncation is removed
 * - Cleaning up orphaned condenseParent/truncationParent tags
 *
 * Usage (always access via Task.messageManager getter):
 * ```typescript
 * await task.messageManager.rewindToTimestamp(messageTs, { includeTargetMessage: false })
 * ```
 *
 * @see Task.messageManager - The getter that provides lazy-initialized access to this manager
 */
export class MessageManager {
	constructor(private task: ITaskModel) {}

	async rewindToTimestamp(ts: number, options: RewindOptions = {}): Promise<void> {
		return rewindToTimestampOp(this.task, ts, options)
	}

	async rewindToIndex(toIndex: number, options: RewindOptions = {}): Promise<void> {
		return rewindToIndexOp(this.task, toIndex, options)
	}
}
