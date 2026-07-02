import { IntentType } from "@jabberwock/types"
import type { Goal } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { sendStateToWebview } from "@features/chat/task/messages/events/actions/sendMessageEvent"

/**
 * Handles task.goal.update.requested intent — updates a goal in the active task.
 */
export function registerOnGoalUpdate(bus: IntentBus): void {
	bus.register(IntentType.TaskGoalUpdateRequested, async (intent, ctx) => {
		const payload = intent.payload as { taskId: string; id: string; text?: string; importance?: number }
		const task = ctx.rootStore.chat.getTask(payload.taskId)

		if (!task) {
			return
		}

		const partial: Partial<Goal> = {}
		if (payload.text !== undefined) partial.text = payload.text
		if (payload.importance !== undefined) partial.importance = payload.importance

		task.updateGoal(payload.id, partial)
		await sendStateToWebview()
	})
}
