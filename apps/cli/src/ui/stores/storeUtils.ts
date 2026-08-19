import type { TUIMessage } from "../types.js"
import type { PendingStreamUpdate } from "./storeTypes.js"

/**
 * Shallow array equality check - compares array length and element references.
 * Used to prevent unnecessary state updates when array content hasn't changed.
 */
export function shallowArrayEqual<T>(a: T[], b: T[]): boolean {
	if (a === b) return true
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false
	}
	return true
}

/**
 * Streaming message debounce configuration.
 * Batches rapid partial message updates to reduce re-renders during streaming.
 */
export const STREAMING_DEBOUNCE_MS = 150

// Pending streaming updates - batched and flushed after debounce interval
const pendingStreamUpdates: Map<string, PendingStreamUpdate> = new Map()
let streamingDebounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Flush all pending streaming updates to the messages array.
 * Returns updated messages array or null if no changes.
 */
function flushPendingUpdates(messages: TUIMessage[]): TUIMessage[] | null {
	const updates = Array.from(pendingStreamUpdates.values())
	pendingStreamUpdates.clear()
	streamingDebounceTimer = null

	if (updates.length === 0) return null

	const newMessages = [...messages]
	let hasChanges = false

	for (const update of updates) {
		const idx = newMessages.findIndex((m) => m.id === update.id)
		if (idx !== -1 && newMessages[idx]) {
			newMessages[idx] = {
				...newMessages[idx],
				content: update.content,
				partial: update.partial,
			}
			hasChanges = true
		}
	}

	return hasChanges ? newMessages : null
}

/**
 * Queue a streaming update and schedule a debounced flush.
 * @param messages - Current messages array to flush against
 * @param onFlush - Callback with updated messages array
 */
export function queueStreamingUpdate(
	id: string,
	content: string,
	messages: TUIMessage[],
	onFlush: (updated: TUIMessage[]) => void,
): void {
	pendingStreamUpdates.set(id, {
		id,
		content,
		partial: true,
		timestamp: Date.now(),
	})

	if (!streamingDebounceTimer) {
		streamingDebounceTimer = setTimeout(() => {
			const result = flushPendingUpdates(messages)
			if (result) {
				onFlush(result)
			}
		}, STREAMING_DEBOUNCE_MS)
	}
}

/**
 * Cancel a pending streaming update for a given message id.
 */
export function cancelStreamingUpdate(id: string): void {
	pendingStreamUpdates.delete(id)
}
