import { BackendIntentType } from "@intentConstants"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles agent.request.failed intent — replaces old system-failure for agent context.
 * Triggered when an API request fails or a stream error occurs.
 */
export function registerOnAgentRequestFailed(bus: IntentBus): void {
	bus.register(BackendIntentType.AgentRequestFailed, async (intent, ctx) => {
		const { taskId, error } = intent.payload as {
			taskId: string
			error: string
		}

		// Add error notification to the task
		const store = ctx.rootStore.chat.tasks.get(taskId)
		if (!store) {
			console.error(`[onAgentRequestFailed] Task ${taskId} not found`)
			return
		}

		store.notifications.addNotification({
			ts: Date.now(),
			type: "say",
			say: "error",
			text: error,
		})
	})
}
