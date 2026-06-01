import { IntentConstants } from "@intentConstants"
import type { IntentBus } from "../../../../../intents/bus"
import type { IntentHandlerContext } from "../../../../../intents/context"
import type { Notification } from "@jabberwock/types"
import { saveMessages } from "../../actions/persistMessages"

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
				// Find and update the existing notification in-place
				const existing = store.notifications.items.find((n: Notification) => n.ts === payload.notification.ts)
				if (existing) {
					Object.assign(existing, payload.notification)
				} else {
					store.notifications.addNotification(payload.notification)
				}
				await saveMessages(payload.taskId)
			} else {
				// Dynamic import to avoid circular dependencies
				const { addNotification } = await import("../../../notifications/actions/addNotification")
				await addNotification(payload.taskId, payload.notification)
			}
		})
	}
}
