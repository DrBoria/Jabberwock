import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"
import type { Notification } from "@jabberwock/types"

/**
 * Handles notification.add intent — creates a Notification in the per-task MST store.
 *
 * Replaces direct calls to addNotification() from action creators like say().
 * The action creator emits the intent, this handler creates the store entry.
 */
export function registerOnNotificationAdd(bus: IntentBus): void {
	bus.register(IntentType.NotificationAdd, async (intent, ctx) => {
		const { taskId, notification } = intent.payload as {
			taskId: string
			notification: Notification
		}

		const taskModel = ctx.rootStore.chat.tasks.get(taskId)
		if (!taskModel) {
			console.error(`[onNotificationAdd] Task ${taskId} not found`)
			return
		}

		// Create the notification in the per-task MST store
		const { addNotification } = await import("../actions/addNotification")
		await addNotification(taskId, notification)
	})
}
