import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"

/**
 * Handles task.created intent — creates a new task and syncs to webview.
 */
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

		const { createTask } = await import("../actions/startTask")
		await createTask(provider, text, images)

		// Notify webview of new task state
		const { postStateToWebview } = await import("../../../foundation/window-manager/store")
		await postStateToWebview(provider)
	})
}
