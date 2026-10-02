import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { sendStateToWebview } from "@features/chat"

/**
 * Handles task.goal.remove.requested intent — removes a goal from "the" active task.
 */
export function registerOnGoalRemove(bus: IntentBus): void {
	bus.register(IntentType.TaskGoalRemoveRequested, async (intent, ctx) => {
		const payload = intent.payload as { taskId: string; id: string }
		const task = ctx.rootStore.chat.getTask(payload.taskId)

		if (!task) {
			return
		}

		task.removeGoal(payload.id)
		await sendStateToWebview()
	})
}
