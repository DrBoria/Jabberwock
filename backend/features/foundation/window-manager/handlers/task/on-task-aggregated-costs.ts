import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { getTaskWithId } from "@features/hist/actions"
import { aggregateTaskCostsRecursive, sendTaskWithAggregatedCosts } from "@features/chat"

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
			await sendTaskWithAggregatedCosts(provider, { text: taskId, error: "Task ID is required" })
			return
		}

		try {
			const { historyItem } = await getTaskWithId(taskId)
			const getTaskHistory = async (id: string) => {
				const result = await getTaskWithId(id)
				return result.historyItem
			}
			const aggregatedCosts = await aggregateTaskCostsRecursive(taskId, getTaskHistory)

			await sendTaskWithAggregatedCosts(provider, { text: taskId, historyItem, aggregatedCosts })
		} catch (error) {
			console.error("[jabberwock] Error getting task with aggregated costs:", error)

			await sendTaskWithAggregatedCosts(provider, {
				text: taskId,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	})
}
