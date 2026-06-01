import type { IntentBus } from "../../../../intents/bus"
import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { registerAllTaskHandlers } from "../../handlers"
import {
	CHAT_TASK_NEW_TASK,
	CHAT_TASK_CANCEL_TASK,
	CHAT_TASK_CLEAR_TASK,
	CHAT_TASK_TASK_SYNC_ENABLED,
	CHAT_TASK_CONDENSE_TASK_CONTEXT_REQUEST,
	CHAT_TASK_WEBVIEW_DID_LAUNCH,
} from "../constants"

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
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "task.cancel.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
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
}
