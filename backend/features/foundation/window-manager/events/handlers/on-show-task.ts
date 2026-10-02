import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import { WINDOW_MANAGER_SHOW_TASK_WITH_ID } from "@features/foundation"

/**
 * Handles SHOW_TASK_WITH_ID event — creates an intent to show a task by ID.
 */
export function registerOnShowTask(): void {
	onWebviewMessage(WINDOW_MANAGER_SHOW_TASK_WITH_ID, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.show",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}
