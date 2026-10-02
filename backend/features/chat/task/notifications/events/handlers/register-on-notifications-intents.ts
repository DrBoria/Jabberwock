import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
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
} from "@features/chat"

/**
 * Register all notification-related event handlers on the given IntentBus.
 *
 * Delegates to the existing registerAllNotificationHandlers in the
 * notifications/handlers/ directory to avoid duplicating registration logic.
 */

function registerOnNotificationsCHATNOTIFICATIONSCHECKPOINTDIFF(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_CHECKPOINT_DIFF, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.checkpoint.diff.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnNotificationsCHATNOTIFICATIONSCHECKPOINTRESTORE(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_CHECKPOINT_RESTORE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.checkpoint.restore.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnNotificationsCHATNOTIFICATIONSPLAYTTS(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_PLAY_TTS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.tts.play",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnNotificationsCHATNOTIFICATIONSSTOPTTS(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_STOP_TTS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.tts.stop",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnNotificationsCHATNOTIFICATIONSTTSENABLED(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_TTS_ENABLED, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.tts.enabled.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnNotificationsCHATNOTIFICATIONSTTSSPEED(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_TTS_SPEED, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.tts.speed.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnNotificationsCHATNOTIFICATIONSQUEUEMESSAGE(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_QUEUE_MESSAGE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.message.queue",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnNotificationsCHATNOTIFICATIONSEDITQUEUEDMESSAGE(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_EDIT_QUEUED_MESSAGE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.message.queue.edit",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnNotificationsCHATNOTIFICATIONSREMOVEQUEUEDMESSAGE(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_REMOVE_QUEUED_MESSAGE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "notification.message.queue.remove",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnNotificationsCHATNOTIFICATIONSELICITATIONRESPONSE(): void {
	onWebviewMessage(CHAT_NOTIFICATIONS_ELICITATION_RESPONSE, (_provider, message) => {
		const store = getStore()
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

export function registerOnNotificationsIntents(bus: IntentBus): void {
	registerAllNotificationHandlers(bus)
	registerOnNotificationsCHATNOTIFICATIONSCHECKPOINTDIFF()
	registerOnNotificationsCHATNOTIFICATIONSCHECKPOINTRESTORE()
	registerOnNotificationsCHATNOTIFICATIONSPLAYTTS()
	registerOnNotificationsCHATNOTIFICATIONSSTOPTTS()
	registerOnNotificationsCHATNOTIFICATIONSTTSENABLED()
	registerOnNotificationsCHATNOTIFICATIONSTTSSPEED()
	registerOnNotificationsCHATNOTIFICATIONSQUEUEMESSAGE()
	registerOnNotificationsCHATNOTIFICATIONSEDITQUEUEDMESSAGE()
	registerOnNotificationsCHATNOTIFICATIONSREMOVEQUEUEDMESSAGE()
	registerOnNotificationsCHATNOTIFICATIONSELICITATIONRESPONSE()
}
