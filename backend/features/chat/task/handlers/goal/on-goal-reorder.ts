import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { sendStateToWebview } from "@features/chat/task/messages/events/actions/sendMessageEvent"

/**
 * Handles task.goal.reorder.requested intent — reorders goals in the active task.
 */
export function registerOnGoalReorder(bus: IntentBus): void {
	bus.register(IntentType.TaskGoalReorderRequested, async (intent, ctx) => {
		const payload = intent.payload as { taskId: string; fromIndex: number; toIndex: number }
		const task = ctx.rootStore.chat.getTask(payload.taskId)

		if (!task) {
			return
		}

		task.reorderGoals(payload.fromIndex, payload.toIndex)
		await sendStateToWebview()
	})
}
