import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles task.cancelled intent — aborts the running task.
 */
import { abortTask } from "@features/chat/task/actions/abortTask"

export function registerOnTaskCancelled(bus: IntentBus): void {
	bus.register(IntentType.TaskCancelled, async (intent, _ctx) => {
		const { taskId } = intent.payload as { taskId: string }

		abortTask(taskId)
	})
}
