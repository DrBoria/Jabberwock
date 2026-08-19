import type { TUIMessage } from "../types.js"
import { cancelStreamingUpdate, queueStreamingUpdate } from "./storeUtils.js"

/**
 * Add a message to the store's messages array with streaming debounce support.
 * New messages are added immediately. Partial messages (streaming) are debounced.
 * Non-partial updates (final) are applied immediately and cancel any pending streaming update.
 */
export function addMessage(messages: TUIMessage[], setMessages: (msgs: TUIMessage[]) => void, msg: TUIMessage): void {
	// Check if message already exists (by ID).
	const existingIndex = messages.findIndex((m) => m.id === msg.id)

	// For NEW messages (not updates) - always apply immediately
	if (existingIndex === -1) {
		setMessages([...messages, msg])
		return
	}

	// For UPDATES to existing messages:
	// If partial (streaming) and message exists, debounce the update
	if (msg.partial) {
		queueStreamingUpdate(msg.id, msg.content, messages, setMessages)
		return
	}

	// Non-partial update (final message) - apply immediately and clear any pending
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
