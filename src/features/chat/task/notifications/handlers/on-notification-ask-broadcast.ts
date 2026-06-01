import { IntentConstants } from "@intentConstants"
import type { IntentBus } from "../../../../intents/bus"
import type { IntentHandlerContext } from "../../../../intents/context"
import type { Notification } from "@jabberwock/types"
import { saveMessages } from "../../../task/messages/actions/persistMessages"

/**
 * The 3 notification ask intent types handled by this broadcast handler.
 */
const NOTIFICATION_TYPES = [
	IntentConstants.notifications.ASK_TOOL_APPROVAL,
	IntentConstants.notifications.ASK_FOLLOW_UP,
	IntentConstants.notifications.ASK_SUB_TASK,
] as const

/**
 * Register a handler for all 3 notification ask broadcast intent types
 * (tool_approval, follow_up, sub_task).
 *
 * When an ask action creator emits an Intent, this handler:
 * 1. Adds (or persists) the notification in the MST store
 * 2. Saves messages to disk
 * 3. Notifies the webview
 *
 * The `action` field in the payload determines whether to create or persist:
 * - (no action or "create") → calls `addNotification(taskId, notification)`
 * - "update" → calls `saveMessages()` + `updateNotification()` to persist
 *   the already-mutated store and notify the webview
 */
export function registerOnNotificationAskBroadcast(bus: IntentBus): void {
	for (const type of NOTIFICATION_TYPES) {
		bus.register(type, async (intent, ctx: IntentHandlerContext) => {
			const payload = intent.payload as {
				taskId: string
				notification: Notification
				action?: "create" | "update"
			}

			if (payload.action === "update") {
				// MST model is already mutated by emitAsk.ts — just persist + notify webview
				await saveMessages(payload.taskId)
				const { updateNotification } = await import("../actions/updateNotification")
				await updateNotification(payload.taskId, payload.notification)
			} else {
				// Dynamic import to avoid circular dependencies
				const { addNotification } = await import("../actions/addNotification")
				await addNotification(payload.taskId, payload.notification)
			}
		})
	}
}
