import type { IntentBus } from "@features/intents/bus"
import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"
import { IntentPriority } from "@features/intents/IntentConstants"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { registerAllTaskHandlers } from "@features/chat/task/handlers"
import { registerOnGoalAdd } from "@features/chat/task/handlers/goal/on-goal-add"
import { registerOnGoalRemove } from "@features/chat/task/handlers/goal/on-goal-remove"
import { registerOnGoalUpdate } from "@features/chat/task/handlers/goal/on-goal-update"
import { registerOnGoalReorder } from "@features/chat/task/handlers/goal/on-goal-reorder"
import {
	CHAT_TASK_NEW_TASK,
	CHAT_TASK_CANCEL_TASK,
	CHAT_TASK_CLEAR_TASK,
	CHAT_TASK_TASK_SYNC_ENABLED,
	CHAT_TASK_CONDENSE_TASK_CONTEXT_REQUEST,
	CHAT_TASK_WEBVIEW_DID_LAUNCH,
} from "@features/chat/task/events/constants"

/**
 * Register all task-related event handlers on the given IntentBus.
 *
 * Delegates to the existing registerAllTaskHandlers in the task/handlers/
 * directory to avoid duplicating registration logic.
 */
export function registerOnTaskIntents(bus: IntentBus): void {
	// ── Register bus handlers (existing task logic) ────────────────
	registerAllTaskHandlers(bus)

	// ── Create onWebviewMessage registrations to replace WEBVIEW_TO_INTENT fallback ──
	onWebviewMessage(CHAT_TASK_NEW_TASK, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.new.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_TASK_CANCEL_TASK, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return

		store.chat.setIsRunning(false)

		// Abort the streaming task model — the streaming loop checks
		// task._state.abort (Task Model level), which is separate from
		// store.chat.abort (Chat Model level). The activeTask view may
		// be null even when the task exists in the tasks map, so we
		// also try via activeTaskId as a fallback.
		const activeTask = store.chat.activeTask
		activeTask?.abortTask?.()
		const taskId = store.chat.activeTaskId
		if (taskId) {
			store.chat.tasks.get(taskId)?.cancelCurrentRequest?.()
		}

		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.cancel.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			priority: IntentPriority.Critical,
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_TASK_CLEAR_TASK, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.clear.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_TASK_TASK_SYNC_ENABLED, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.sync.enabled.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_TASK_CONDENSE_TASK_CONTEXT_REQUEST, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.condense.context.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CHAT_TASK_WEBVIEW_DID_LAUNCH, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.webview.launched",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	registerOnGoalAdd(bus)
	registerOnGoalRemove(bus)
	registerOnGoalUpdate(bus)
	registerOnGoalReorder(bus)
}
