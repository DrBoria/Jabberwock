/**
 * MessageManager — manages message history operations
 *
 * Provides rewind functionality for the time-machine feature.
 *
 * @module features/chat/task/messages/actions/createMessageManager
 *
 * @description
 * The MessageManager handles all message history operations, particularly
 * the rewind functionality used by the time-machine feature.
 *
 * Usage (always access via Task.messageManager getter):
 * ```typescript
 * await task.messageManager.rewindToTimestamp(messageTs, { includeTargetMessage: false })
 * ```
 *
 * @see Task.messageManager - The getter that provides lazy-initialized access to this manager
 */

import type { ITaskModel } from "@features/chat/task"

import { rewindToTimestamp as rewindToTimestampOp, rewindToIndex as rewindToIndexOp } from "./moveMessages"
import type { RewindOptions } from "./filterMessageHistory"

/**
 * MessageManager — manages message history operations
 *
 * Provides rewind functionality for the time-machine feature.
 *
 * @param task - The task model to manage messages for
 * @returns Object with rewind operations
 */
export function MessageManager(task: ITaskModel) {
	return {
		/**
		 * Rewind to a specific timestamp
		 * @param ts - The timestamp to rewind to
		 * @param options - Optional rewind options
		 */
		rewindToTimestamp: (ts: number, options: RewindOptions = {}) => rewindToTimestampOp(task, ts, options),

		/**
		 * Rewind to a specific message index
		 * @param toIndex - The index to rewind to
		 * @param options - Optional rewind options
		 */
		rewindToIndex: (toIndex: number, options: RewindOptions = {}) => rewindToIndexOp(task, toIndex, options),
	}
}

/** MessageManager instance type */
export type MessageManager = ReturnType<typeof MessageManager>
