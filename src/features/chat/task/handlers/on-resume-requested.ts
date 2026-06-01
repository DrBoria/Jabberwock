import { IntentType, IntentStatus } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"

/**
 * Handles task.resume.requested intent — resumes a task from history.
 */
export function registerOnTaskResumeRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskResumeRequested, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		const { taskId } = intent.payload as { taskId: string }

		try {
			const { getTaskWithId } = await import("../../../history/actions/index")
			const { historyItem } = await getTaskWithId(provider, taskId)
			if (historyItem) {
				const { createTaskWithHistoryItem } = await import("../../task/actions/startTask")
				await createTaskWithHistoryItem(provider, historyItem)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			ctx.intentStore.createIntent({
				id: crypto.randomUUID(),
				type: IntentType.SystemFailure,
				payload: { taskId, error: errorMessage },
				status: IntentStatus.Queued,
				createdAt: Date.now(),
			})
		}
	})
}
