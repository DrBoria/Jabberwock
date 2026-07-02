import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { sendStateToWebview } from "@features/chat/task/messages/events/actions/sendMessageEvent"

/**
 * Handles task.goal.add.requested intent — adds a goal to the active task.
 */
export function registerOnGoalAdd(bus: IntentBus): void {
	bus.register(IntentType.TaskGoalAddRequested, async (intent, ctx) => {
		const payload = intent.payload as { taskId: string; text: string; importance?: number }
		const task = ctx.rootStore.chat.getTask(payload.taskId)

		if (!task) {
			return
		}

		task.addGoal(payload.text, payload.importance)
		await sendStateToWebview()
	})
}
