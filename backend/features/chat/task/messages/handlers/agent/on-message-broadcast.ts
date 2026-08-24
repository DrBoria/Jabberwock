import { IntentConstants } from "@intentConstants"
import type { IntentBus } from "@features/intents/bus"
import type { IntentHandlerContext } from "@features/intents/context"
import type { Notification } from "@jabberwock/types"
import { saveMessages } from "@features/chat/task/messages/actions/saveMessages"

/**
 * Register a handler for all 4 message broadcast intent types
 * (agent, system, MCP, user).
 *
 * When a broadcast action creator emits an Intent, this handler:
 * 1. Adds (or updates) the notification in the MST store
 * 2. Saves messages to disk
 *
 * The `action` field in the payload determines whether to create or update:
 * - "create" → calls `addNotification(taskId, notification)`
 * - "update" → mutates the existing notification in-place + saves
 */
import { addNotification } from "@features/chat/task/notifications/actions"
import { sendMessageUpdated } from "@features/chat/task/messages/events/actions/sendMessageEvent"

export function registerOnMessageBroadcast(bus: IntentBus): void {
	const broadcastTypes = [
		IntentConstants.messages.AGENT_BROADCAST,
		IntentConstants.messages.SYSTEM_BROADCAST,
		IntentConstants.messages.MCP_BROADCAST,
		IntentConstants.messages.USER_BROADCAST,
	] as const

	for (const type of broadcastTypes) {
		bus.register(type, async (intent, ctx: IntentHandlerContext) => {
			const payload = intent.payload as {
				taskId: string
				notification: Notification
				action: "create" | "update"
			}

			const store = ctx.rootStore.chat.tasks.get(payload.taskId)
			if (!store) {
				console.error(`[onMessageBroadcast] Task ${payload.taskId} not found`)
				return
			}

			if (payload.action === "update") {
				const index = store.notifications.items.findIndex((n: Notification) => n.ts === payload.notification.ts)
				if (index !== -1) {
					store.notifications.updateNotification(index, payload.notification)
				} else {
					store.notifications.addNotification(payload.notification)
				}
				// ── Streaming performance optimisation ─────────────────────
				// For partial (streaming) message updates, skip disk I/O and
				// redundant webview notification.  The sendStreamChunk() fast
				// path already provides real-time UI updates; disk persistence
				// is deferred until the stream ends (non-partial flush).
				if (!payload.notification.partial) {
					await saveMessages(payload.taskId)
					sendMessageUpdated(payload.notification)
				}
			} else {
				await addNotification(payload.taskId, payload.notification)
			}
		})
	}
}
