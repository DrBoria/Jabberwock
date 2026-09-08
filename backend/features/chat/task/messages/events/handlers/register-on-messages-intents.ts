import type { IntentBus } from "@features/intents/bus"
import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"
import { askClaimTracker } from "@features/foundation/webview/ask-claims"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { registerAllMessageHandlers } from "@features/chat/task/messages/handlers"
import {
	CHAT_MESSAGES_LIST_ASK_RESPONSE,
	CHAT_MESSAGES_LIST_DELETE_MESSAGE,
	CHAT_MESSAGES_LIST_DELETE_MESSAGE_CONFIRM,
	CHAT_MESSAGES_LIST_SUBMIT_EDITED_MESSAGE,
	CHAT_MESSAGES_LIST_EDIT_MESSAGE_CONFIRM,
} from "@features/chat/task/messages/events/constants"

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
	onWebviewMessage(CHAT_MESSAGES_LIST_ASK_RESPONSE, (provider, message, senderClientId) => {
		const store = getBackendRootStore()
		if (!store) return

		// D4h (§6.4): first-response-wins for multi-client asks. Engages only when the answer
		// carries a requestId (broadcast-ask case) AND a concrete decision; the legacy single-client
		// ask (no requestId) takes the plain intent path below unchanged. The FIRST response for a
		// requestId claims the decision and is broadcast to every client (convergence); every later
		// response is a duplicate — the late responder is acked as already-answered.
		const requestId = message.requestId
		const decision = message.askResponse
		if (requestId && decision !== undefined) {
			const result = askClaimTracker.claim(requestId, decision)
			if (result.status === "already-answered") {
				void provider.postMessageToWebview(
					{ type: "askResponseAck", requestId, status: "already-answered" },
					senderClientId ? { kind: "client", clientId: senderClientId } : undefined,
				)
				return
			}
			// First response claimed — broadcast the converged decision to all connected clients
			// (§6.4 step 4) so every UI converges on the single winning answer.
			void provider.postMessageToWebview({
				type: "notification.ask.resolved",
				requestId,
				askResponse: decision,
				text: message.text,
			})
		}

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
