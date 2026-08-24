import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getTaskWithId, deleteTaskFromState } from "@features/hist/actions"

/**
 * Handles foundation.task.delete.multiple intent — batch deletes tasks.
 */
export function registerOnTaskDeleteMultiple(bus: IntentBus): void {
	bus.register(IntentType.FoundationTaskDeleteMultiple, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { ids: string[] }
		const ids = payload.ids

		if (Array.isArray(ids)) {
			const batchSize = 20
			const results = []

			console.log(`Batch deletion started: ${ids.length} tasks total`)

			for (let i = 0; i < ids.length; i += batchSize) {
				const batch = ids.slice(i, i + batchSize)

				const batchPromises = batch.map(async (id: string) => {
					try {
						const collectChildIds = async (taskId: string): Promise<string[]> => {
							const ids: string[] = [taskId]
							const { historyItem } = await getTaskWithId(taskId)
							if (historyItem?.childIds) {
								for (const childId of historyItem.childIds) {
									const childIds = await collectChildIds(childId)
									ids.push(...childIds)
								}
							}
							return ids
						}

						const allIdsToDelete = await collectChildIds(id)

						for (const deleteId of allIdsToDelete) {
							await deleteTaskFromState(deleteId)
						}

						return { id, success: true } as const
					} catch (error) {
						console.log(
							`Failed to delete task ${id}: ${error instanceof Error ? error.message : String(error)}`,
						)
						return { id, success: false } as const
					}
				})

				const batchResults = await Promise.all(batchPromises)
				results.push(...batchResults)

				await postStateToWebview(provider)
			}

			const successCount = results.filter((r) => r.success).length
			const failCount = results.length - successCount
			console.log(
				`Batch deletion completed: ${successCount}/${ids.length} tasks successful, ${failCount} tasks failed`,
			)
		}
	})
}
