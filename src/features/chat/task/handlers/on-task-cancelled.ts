import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"

/**
 * Handles task.cancelled intent — aborts the running task.
 */
export function registerOnTaskCancelled(bus: IntentBus): void {
	bus.register(IntentType.TaskCancelled, async (intent, _ctx) => {
		const { taskId } = intent.payload as { taskId: string }

		const { abortTask } = await import("../actions/abortTask")
		abortTask(taskId)
	})
}
