import type { IntentBus } from "@features/intents/bus"
import { registerOnHistory } from "@features/hist/handlers/on-history"
import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import {
	HISTORY_SEARCH_COMMITS,
	HISTORY_IMPORT_SETTINGS,
	HISTORY_EXPORT_SETTINGS,
	HISTORY_RESET_STATE,
	HISTORY_HISTORY_BUTTON_CLICKED,
} from "@features/hist/events/constants"

export function registerOnHistoryIntents(bus: IntentBus): void {
	registerOnHistory(bus)

	onWebviewMessage(HISTORY_SEARCH_COMMITS, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "history.commits.search",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(HISTORY_IMPORT_SETTINGS, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "history.settings.import",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(HISTORY_EXPORT_SETTINGS, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "history.settings.export",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(HISTORY_RESET_STATE, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "history.state.reset",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(HISTORY_HISTORY_BUTTON_CLICKED, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "history.button.clicked",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}
