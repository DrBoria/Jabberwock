import type { IntentBus } from "../../../../intents/bus"
import { registerAllFoundationHandlers } from "../../handlers"

/**
 * Register all window-manager event handlers on the given IntentBus.
 *
 * Delegates to the existing registerAllFoundationHandlers in the
 * window-manager/handlers/ directory to avoid duplicating registration logic.
 */
import { onWebviewMessage } from "../../../webview/events/handlers/on-webview-message"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import {
	WINDOW_MANAGER_FOCUS_PANEL_REQUEST,
	WINDOW_MANAGER_SWITCH_TAB,
	WINDOW_MANAGER_ACTIVE_PAGE_RESPONSE,
	WINDOW_MANAGER_REQUEST_STATE,
	WINDOW_MANAGER_GET_TASK_WITH_AGGREGATED_COSTS,
	WINDOW_MANAGER_SHOW_TASK_WITH_ID,
	WINDOW_MANAGER_DELETE_TASK_WITH_ID,
	WINDOW_MANAGER_EXPORT_TASK_WITH_ID,
	WINDOW_MANAGER_EXPORT_CURRENT_TASK,
	WINDOW_MANAGER_DELETE_MULTIPLE_TASKS_WITH_IDS,
} from "../constants"

export function registerOnWindowManagerIntents(bus: IntentBus): void {
	registerAllFoundationHandlers(bus)

	onWebviewMessage(WINDOW_MANAGER_FOCUS_PANEL_REQUEST, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.focus.panel.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(WINDOW_MANAGER_SWITCH_TAB, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.tab.switch",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(WINDOW_MANAGER_ACTIVE_PAGE_RESPONSE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.active.page.response",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(WINDOW_MANAGER_REQUEST_STATE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.state.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(WINDOW_MANAGER_GET_TASK_WITH_AGGREGATED_COSTS, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.aggregated.costs",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

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

	onWebviewMessage(WINDOW_MANAGER_DELETE_TASK_WITH_ID, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.delete",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(WINDOW_MANAGER_EXPORT_TASK_WITH_ID, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.export",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(WINDOW_MANAGER_EXPORT_CURRENT_TASK, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.export.current",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(WINDOW_MANAGER_DELETE_MULTIPLE_TASKS_WITH_IDS, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.delete.multiple",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}
