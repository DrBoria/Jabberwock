import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { askClaimTracker } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import { registerAllMessageHandlers } from "@features/chat/task/messages/handlers"
import { submitAskResponse, sendAskResponseAck, sendNotificationAskResolved } from "@features/chat"
import {
	CHAT_MESSAGES_LIST_ASK_RESPONSE,
	CHAT_MESSAGES_LIST_DELETE_MESSAGE,
	CHAT_MESSAGES_LIST_DELETE_MESSAGE_CONFIRM,
	CHAT_MESSAGES_LIST_SUBMIT_EDITED_MESSAGE,
	CHAT_MESSAGES_LIST_EDIT_MESSAGE_CONFIRM,
} from "@features/chat"

/**
 * Register all message-related event handlers on the given IntentBus.
 *
 * Delegates to the existing registerAllMessageHandlers in the messages/handlers/
 * directory to avoid duplicating registration logic.
 */

function registerOnMessagesCHATMESSAGESLISTASKRESPONSE(): void {
	onWebviewMessage(CHAT_MESSAGES_LIST_ASK_RESPONSE, (provider, message, senderClientId) => {
		const store = getStore()
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
				void sendAskResponseAck(
					provider,
					{ requestId, status: "already-answered" },
					senderClientId ? { kind: "client", clientId: senderClientId } : undefined,
				)
				return
			}
			// First response claimed — broadcast the converged decision to all connected clients
			// (§6.4 step 4) so every UI converges on the single winning answer.
			void sendNotificationAskResolved(provider, { requestId, askResponse: decision, text: message.text })
		}

		// Resolve the ask synchronously (outside the bus). The previous intent
		// path deadlocked: the ask response queued behind the single dispatch
		// fiber that was blocked awaiting the ask itself, so the dialog could
		// never be answered. `submitAskResponse` resolves
		// `task.askResolve` directly — idempotent with the legacy intent
		// handler, which is left registered for residual intents.
		if (decision !== undefined) {
			submitAskResponse(store.chat.activeTaskId ?? "", decision, message.text, message.images)
		}
	})
}

function registerOnMessagesCHATMESSAGESLISTDELETEMESSAGE(): void {
	onWebviewMessage(CHAT_MESSAGES_LIST_DELETE_MESSAGE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "message.delete.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMessagesCHATMESSAGESLISTDELETEMESSAGECONFIRM(): void {
	onWebviewMessage(CHAT_MESSAGES_LIST_DELETE_MESSAGE_CONFIRM, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "message.delete.confirmed",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMessagesCHATMESSAGESLISTSUBMITEDITEDMESSAGE(): void {
	onWebviewMessage(CHAT_MESSAGES_LIST_SUBMIT_EDITED_MESSAGE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "message.edit.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMessagesCHATMESSAGESLISTEDITMESSAGECONFIRM(): void {
	onWebviewMessage(CHAT_MESSAGES_LIST_EDIT_MESSAGE_CONFIRM, (_provider, message) => {
		const store = getStore()
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

export function registerOnMessagesIntents(bus: IntentBus): void {
	registerAllMessageHandlers(bus)
	registerOnMessagesCHATMESSAGESLISTASKRESPONSE()
	registerOnMessagesCHATMESSAGESLISTDELETEMESSAGE()
	registerOnMessagesCHATMESSAGESLISTDELETEMESSAGECONFIRM()
	registerOnMessagesCHATMESSAGESLISTSUBMITEDITEDMESSAGE()
	registerOnMessagesCHATMESSAGESLISTEDITMESSAGECONFIRM()
}
