import type { TUIMessage } from "./types.js"

/**
 * Pending streaming updates - batched and flushed after debounce interval.
 */
interface PendingStreamUpdate {
	id: string
	content: string
	partial: boolean
	timestamp: number
}

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
const STREAMING_DEBOUNCE_MS = 150

// Pending streaming updates - batched and flushed after debounce interval.
// Held in a const holder object (not a mutable module `let`) so there is no
// top-level mutable state.
const streamingUpdateState: {
	pending: Map<string, PendingStreamUpdate>
	timer: ReturnType<typeof setTimeout> | null
} = { pending: new Map(), timer: null }

/**
 * Flush all pending streaming updates to the messages array.
 * Returns updated messages array or null if no changes.
 */
function flushPendingUpdates(messages: TUIMessage[]): TUIMessage[] | null {
	const updates = Array.from(streamingUpdateState.pending.values())
	streamingUpdateState.pending.clear()
	streamingUpdateState.timer = null

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
 */
function queueStreamingUpdate(
	id: string,
	content: string,
	messages: TUIMessage[],
	onFlush: (updated: TUIMessage[]) => void,
): void {
	streamingUpdateState.pending.set(id, {
		id,
		content,
		partial: true,
		timestamp: Date.now(),
	})

	if (!streamingUpdateState.timer) {
		streamingUpdateState.timer = setTimeout(() => {
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
function cancelStreamingUpdate(id: string): void {
	streamingUpdateState.pending.delete(id)
}

/**
 * Add a message to the store's messages array with streaming debounce support.
 * New messages are added immediately. Partial messages (streaming) are debounced.
 * Non-partial updates (final) are applied immediately and cancel any pending streaming update.
 */
export function addMessage(messages: TUIMessage[], setMessages: (msgs: TUIMessage[]) => void, msg: TUIMessage): void {
	const existingIndex = messages.findIndex((m) => m.id === msg.id)

	if (existingIndex === -1) {
		setMessages([...messages, msg])
		return
	}

	if (msg.partial) {
		queueStreamingUpdate(msg.id, msg.content, messages, setMessages)
		return
	}

	cancelStreamingUpdate(msg.id)
	const updated = [...messages]
	updated[existingIndex] = msg
	setMessages(updated)
}

/**
 * Update an existing message's content directly without streaming debounce.
 */
export function updateMessage(
	messages: TUIMessage[],
	setMessages: (msgs: TUIMessage[]) => void,
	id: string,
	content: string,
	partial?: boolean,
): void {
	const index = messages.findIndex((m) => m.id === id)

	if (index === -1) {
		return
	}

	const existing = messages[index]

	if (!existing) {
		return
	}

	const updated = [...messages]

	updated[index] = {
		...existing,
		content,
		partial: partial !== undefined ? partial : existing.partial,
	}

	setMessages(updated)
}
