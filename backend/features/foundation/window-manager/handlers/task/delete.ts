import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { postStateToWebview } from "@features/foundation"
import { getTaskWithId, deleteTaskFromState } from "@features/hist/actions"

/**
 * Handles foundation.task.delete intent — deletes a task and its children by ID.
 */
export function registerOnTaskDelete(bus: IntentBus): void {
	bus.register(IntentType.FoundationTaskDelete, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		const id = payload.text!
		if (!id) return

		// Recursively collect all child IDs
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

		// Delete from "state"
		for (const deleteId of allIdsToDelete) {
			await deleteTaskFromState(deleteId)
		}

		// If it's the current task, remove from "stack"
		if (ctx.rootStore.chat.activeTask?.taskId === id) {
			ctx.rootStore.chat.activeTask?.abortTask?.()
			ctx.rootStore.chat.removeTask(id)
		}

		await postStateToWebview(provider)
	})
}

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
