import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import type { Notification } from "@jabberwock/types"

/**
 * Handles ask.notification intent — creates an ask-type Notification in the
 * per-task MST store.
 *
 * Action creators like ask() emit this intent to decouple notification
 * creation from the ask logic.
 */
import { addNotification } from "@features/chat/task/notifications/actions/core/addNotification"

export function registerOnAskNotification(bus: IntentBus): void {
	bus.register(IntentType.AskNotification, async (intent, ctx) => {
		const { taskId, notification } = intent.payload as {
			taskId: string
			notification: Notification
		}

		const taskModel = ctx.rootStore.chat.tasks.get(taskId)
		if (!taskModel) {
			console.error(`[onAskNotification] Task ${taskId} not found`)
			return
		}

		await addNotification(taskId, notification)
	})
}
