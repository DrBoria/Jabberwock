import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { WINDOW_MANAGER_SHOW_TASK_WITH_ID } from "@features/foundation/window-manager/events/constants"

/**
 * Handles SHOW_TASK_WITH_ID event — creates an intent to show a task by ID.
 */
export function registerOnShowTask(): void {
	onWebviewMessage(WINDOW_MANAGER_SHOW_TASK_WITH_ID, (_provider, message) => {
		const store = getBackendRootStore()
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
