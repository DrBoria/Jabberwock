import type { IntentBus } from "@features/intents"
import { registerOnHistory } from "@features/hist"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	HISTORY_SEARCH_COMMITS,
	HISTORY_IMPORT_SETTINGS,
	HISTORY_EXPORT_SETTINGS,
	HISTORY_RESET_STATE,
	HISTORY_HISTORY_BUTTON_CLICKED,
} from "@features/hist"

function registerOnHistoryHISTORYSEARCHCOMMITS(): void {
	onWebviewMessage(HISTORY_SEARCH_COMMITS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "history.commits.search",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnHistoryHISTORYIMPORTSETTINGS(): void {
	onWebviewMessage(HISTORY_IMPORT_SETTINGS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "history.settings.import",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnHistoryHISTORYEXPORTSETTINGS(): void {
	onWebviewMessage(HISTORY_EXPORT_SETTINGS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "history.settings.export",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnHistoryHISTORYRESETSTATE(): void {
	onWebviewMessage(HISTORY_RESET_STATE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "history.state.reset",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnHistoryHISTORYHISTORYBUTTONCLICKED(): void {
	onWebviewMessage(HISTORY_HISTORY_BUTTON_CLICKED, (_provider, message) => {
		const store = getStore()
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

export function registerOnHistoryIntents(bus: IntentBus): void {
	registerOnHistory(bus)
	registerOnHistoryHISTORYSEARCHCOMMITS()
	registerOnHistoryHISTORYIMPORTSETTINGS()
	registerOnHistoryHISTORYEXPORTSETTINGS()
	registerOnHistoryHISTORYRESETSTATE()
	registerOnHistoryHISTORYHISTORYBUTTONCLICKED()
}
