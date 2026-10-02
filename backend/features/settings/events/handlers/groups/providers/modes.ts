import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	AGENT_STATE_UPDATE_CUSTOM_MODE,
	AGENT_STATE_DELETE_CUSTOM_MODE,
	AGENT_STATE_EXPORT_MODE,
	AGENT_STATE_IMPORT_MODE,
	AGENT_STATE_CHECK_RULES_DIRECTORY,
	AGENT_STATE_HAS_OPENED_MODE_SELECTOR,
	AGENT_STATE_OPEN_CUSTOM_MODES_SETTINGS,
} from "@features/settings"

function registerModesHandlersAGENTSTATEUPDATECUSTOMMODE(): void {
	onWebviewMessage(AGENT_STATE_UPDATE_CUSTOM_MODE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mode.custom.update",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModesHandlersAGENTSTATEDELETECUSTOMMODE(): void {
	onWebviewMessage(AGENT_STATE_DELETE_CUSTOM_MODE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mode.custom.delete",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModesHandlersAGENTSTATEEXPORTMODE(): void {
	onWebviewMessage(AGENT_STATE_EXPORT_MODE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mode.export",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModesHandlersAGENTSTATEIMPORTMODE(): void {
	onWebviewMessage(AGENT_STATE_IMPORT_MODE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mode.import",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModesHandlersAGENTSTATECHECKRULESDIRECTORY(): void {
	onWebviewMessage(AGENT_STATE_CHECK_RULES_DIRECTORY, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mode.rules.directory.check",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModesHandlersAGENTSTATEHASOPENEDMODESELECTOR(): void {
	onWebviewMessage(AGENT_STATE_HAS_OPENED_MODE_SELECTOR, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mode.selector.opened",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModesHandlersAGENTSTATEOPENCUSTOMMODESSETTINGS(): void {
	onWebviewMessage(AGENT_STATE_OPEN_CUSTOM_MODES_SETTINGS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mode.custom.settings.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerModesHandlers(_bus: IntentBus): void {
	registerModesHandlersAGENTSTATEUPDATECUSTOMMODE()
	registerModesHandlersAGENTSTATEDELETECUSTOMMODE()
	registerModesHandlersAGENTSTATEEXPORTMODE()
	registerModesHandlersAGENTSTATEIMPORTMODE()
	registerModesHandlersAGENTSTATECHECKRULESDIRECTORY()
	registerModesHandlersAGENTSTATEHASOPENEDMODESELECTOR()
	registerModesHandlersAGENTSTATEOPENCUSTOMMODESSETTINGS()
}
