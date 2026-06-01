import type { IntentBus } from "../../../../../intents/bus"
import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { registerAllMessageHandlers } from "../../handlers"
import {
	CHAT_MESSAGES_LIST_ASK_RESPONSE,
	CHAT_MESSAGES_LIST_DELETE_MESSAGE,
	CHAT_MESSAGES_LIST_DELETE_MESSAGE_CONFIRM,
	CHAT_MESSAGES_LIST_SUBMIT_EDITED_MESSAGE,
	CHAT_MESSAGES_LIST_EDIT_MESSAGE_CONFIRM,
} from "../constants"

/**
 * Register all message-related event handlers on the given IntentBus.
 *
 * Delegates to the existing registerAllMessageHandlers in the messages/handlers/
 * directory to avoid duplicating registration logic.
 */
export function registerOnMessagesIntents(bus: IntentBus): void {
	// ── Register bus handlers (existing message logic) ─────────────
	registerAllMessageHandlers(bus)

	// ── onWebviewMessage registrations to replace WEBVIEW_TO_INTENT fallback ──
	onWebviewMessage(CHAT_MESSAGES_LIST_ASK_RESPONSE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "ask.response.received",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_MESSAGES_LIST_DELETE_MESSAGE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "message.delete.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_MESSAGES_LIST_DELETE_MESSAGE_CONFIRM, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "message.delete.confirmed",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_MESSAGES_LIST_SUBMIT_EDITED_MESSAGE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "message.edit.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_MESSAGES_LIST_EDIT_MESSAGE_CONFIRM, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "message.edit.confirmed",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}
