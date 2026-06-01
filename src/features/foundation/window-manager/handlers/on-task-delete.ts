import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { postStateToWebview } from "../store"
import { getTaskWithId, deleteTaskFromState } from "../../../history/actions"

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
			const { historyItem } = await getTaskWithId(provider, taskId)
			if (historyItem?.childIds) {
				for (const childId of historyItem.childIds) {
					const childIds = await collectChildIds(childId)
					ids.push(...childIds)
				}
			}
			return ids
		}

		const allIdsToDelete = await collectChildIds(id)

		// Delete from state
		for (const deleteId of allIdsToDelete) {
			await deleteTaskFromState(provider, deleteId)
		}

		// If it's the current task, remove from stack
		if (ctx.rootStore.chat.activeTask?.taskId === id) {
			ctx.rootStore.chat.activeTask?.abortTask?.()
			ctx.rootStore.chat.removeTask(id)
		}

		await postStateToWebview(provider)
	})
}
