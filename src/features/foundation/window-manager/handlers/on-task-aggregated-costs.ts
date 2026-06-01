import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { postMessageToWebview } from "../store"
import { getTaskWithId } from "../../../history/actions"
import { aggregateTaskCostsRecursive } from "../../../chat/task/actions/aggregateTaskCosts"

/**
 * Handles foundation.task.aggregated.costs intent — gets task with aggregated costs.
 */
export function registerOnTaskAggregatedCosts(bus: IntentBus): void {
	bus.register(IntentType.FoundationTaskAggregatedCosts, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		const taskId = payload.text

		if (!taskId) {
			await postMessageToWebview(provider, {
				type: "taskWithAggregatedCosts",
				text: taskId,
				error: "Task ID is required",
			})
			return
		}

		try {
			const { historyItem } = await getTaskWithId(provider, taskId)
			const getTaskHistory = async (id: string) => {
				const result = await getTaskWithId(provider, id)
				return result.historyItem
			}
			const aggregatedCosts = await aggregateTaskCostsRecursive(taskId, getTaskHistory)

			await postMessageToWebview(provider, {
				type: "taskWithAggregatedCosts",
				text: taskId,
				historyItem,
				aggregatedCosts,
			})
		} catch (error) {
			console.error("[jabberwock] Error getting task with aggregated costs:", error)

			await postMessageToWebview(provider, {
				type: "taskWithAggregatedCosts",
				text: taskId,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	})
}
