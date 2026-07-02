import { IntentType } from "@jabberwock/types"
import type { NotificationSay } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles agent.response.received intent — processes an assistant's response
 * and adds it to the message history.
 */
export function registerOnAgentResponseReceived(bus: IntentBus): void {
	bus.register(IntentType.AgentResponseReceived, async (intent, ctx) => {
		const { taskId, notification } = intent.payload as {
			taskId: string
			notification: { text: string; say: string; ts?: number }
		}

		const store = ctx.rootStore.chat.tasks.get(taskId)
		if (!store) {
			console.error(`[onAgentResponseReceived] Task ${taskId} not found`)
			return
		}

		// Add the notification to the task's messages
		store.notifications.addNotification({
			...notification,
			say: notification.say as NotificationSay,
			ts: notification.ts ?? Date.now(),
			type: "say",
		})
	})
}
