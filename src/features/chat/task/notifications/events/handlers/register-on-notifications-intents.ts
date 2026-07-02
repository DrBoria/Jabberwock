import type { IntentBus } from "@features/intents/bus"
import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { registerAllNotificationHandlers } from "@features/chat/task/notifications/handlers"
import {
	CHAT_NOTIFICATIONS_CHECKPOINT_DIFF,
	CHAT_NOTIFICATIONS_CHECKPOINT_RESTORE,
	CHAT_NOTIFICATIONS_PLAY_TTS,
	CHAT_NOTIFICATIONS_STOP_TTS,
	CHAT_NOTIFICATIONS_TTS_ENABLED,
	CHAT_NOTIFICATIONS_TTS_SPEED,
	CHAT_NOTIFICATIONS_QUEUE_MESSAGE,
	CHAT_NOTIFICATIONS_EDIT_QUEUED_MESSAGE,
	CHAT_NOTIFICATIONS_REMOVE_QUEUED_MESSAGE,
	CHAT_NOTIFICATIONS_ELICITATION_RESPONSE,
} from "@features/chat/task/notifications/events/constants"

/**
 * Register all notification-related event handlers on the given IntentBus.
 *
 * Delegates to the existing registerAllNotificationHandlers in the
 * notifications/handlers/ directory to avoid duplicating registration logic.
 */
export function registerOnNotificationsIntents(bus: IntentBus): void {
	// ── Register bus handlers (existing notification logic) ─────────
	registerAllNotificationHandlers(bus)

	// ── onWebviewMessage registrations to replace WEBVIEW_TO_INTENT fallback ──
	onWebviewMessage(CHAT_NOTIFICATIONS_CHECKPOINT_DIFF, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.checkpoint.diff.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_NOTIFICATIONS_CHECKPOINT_RESTORE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.checkpoint.restore.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_NOTIFICATIONS_PLAY_TTS, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.tts.play",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_NOTIFICATIONS_STOP_TTS, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.tts.stop",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_NOTIFICATIONS_TTS_ENABLED, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.tts.enabled.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_NOTIFICATIONS_TTS_SPEED, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.tts.speed.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_NOTIFICATIONS_QUEUE_MESSAGE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.message.queue",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_NOTIFICATIONS_EDIT_QUEUED_MESSAGE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.message.queue.edit",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_NOTIFICATIONS_REMOVE_QUEUED_MESSAGE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.message.queue.remove",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_NOTIFICATIONS_ELICITATION_RESPONSE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.elicitation.response",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}
