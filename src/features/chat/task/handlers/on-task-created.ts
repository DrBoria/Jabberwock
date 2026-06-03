import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles task.created intent — creates a new task and syncs to webview.
 */
import { createTask } from "@features/chat/task/actions/startTask"
import { postStateToWebview } from "@features/foundation/window-manager/store"

export function registerOnTaskCreated(bus: IntentBus): void {
	bus.register(IntentType.TaskCreated, async (intent, ctx) => {
		const { taskId, text, images } = intent.payload as {
			taskId: string
			text?: string
			images?: string[]
		}

		const provider = ctx.provider

		if (!provider) {
			console.error(`[onTaskCreated] No provider available for task ${taskId}`)
			return
		}

		await createTask(provider, text, images)

		// Notify webview of new task state
		await postStateToWebview(provider)
	})
}
