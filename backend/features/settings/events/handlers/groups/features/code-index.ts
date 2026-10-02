import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	AGENT_STATE_SAVE_CODE_INDEX_SETTINGS_ATOMIC,
	AGENT_STATE_REQUEST_INDEXING_STATUS,
	AGENT_STATE_REQUEST_CODE_INDEX_SECRET_STATUS,
	AGENT_STATE_START_INDEXING,
	AGENT_STATE_STOP_INDEXING,
	AGENT_STATE_TOGGLE_WORKSPACE_INDEXING,
	AGENT_STATE_SET_AUTO_ENABLE_DEFAULT,
	AGENT_STATE_CLEAR_INDEX_DATA,
} from "@features/settings"

function registerCodeIndexHandlersAGENTSTATESAVECODEINDEXSETTINGSATOMIC(): void {
	onWebviewMessage(AGENT_STATE_SAVE_CODE_INDEX_SETTINGS_ATOMIC, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.code.index.save",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerCodeIndexHandlersAGENTSTATEREQUESTINDEXINGSTATUS(): void {
	onWebviewMessage(AGENT_STATE_REQUEST_INDEXING_STATUS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.code.index.status",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerCodeIndexHandlersAGENTSTATEREQUESTCODEINDEXSECRETSTATUS(): void {
	onWebviewMessage(AGENT_STATE_REQUEST_CODE_INDEX_SECRET_STATUS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.code.index.secret.status",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerCodeIndexHandlersAGENTSTATESTARTINDEXING(): void {
	onWebviewMessage(AGENT_STATE_START_INDEXING, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.code.index.start",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerCodeIndexHandlersAGENTSTATESTOPINDEXING(): void {
	onWebviewMessage(AGENT_STATE_STOP_INDEXING, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.code.index.stop",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerCodeIndexHandlersAGENTSTATETOGGLEWORKSPACEINDEXING(): void {
	onWebviewMessage(AGENT_STATE_TOGGLE_WORKSPACE_INDEXING, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.code.index.workspace.toggle",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerCodeIndexHandlersAGENTSTATESETAUTOENABLEDEFAULT(): void {
	onWebviewMessage(AGENT_STATE_SET_AUTO_ENABLE_DEFAULT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.code.index.auto.enable",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerCodeIndexHandlersAGENTSTATECLEARINDEXDATA(): void {
	onWebviewMessage(AGENT_STATE_CLEAR_INDEX_DATA, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.code.index.clear",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerCodeIndexHandlers(_bus: IntentBus): void {
	registerCodeIndexHandlersAGENTSTATESAVECODEINDEXSETTINGSATOMIC()
	registerCodeIndexHandlersAGENTSTATEREQUESTINDEXINGSTATUS()
	registerCodeIndexHandlersAGENTSTATEREQUESTCODEINDEXSECRETSTATUS()
	registerCodeIndexHandlersAGENTSTATESTARTINDEXING()
	registerCodeIndexHandlersAGENTSTATESTOPINDEXING()
	registerCodeIndexHandlersAGENTSTATETOGGLEWORKSPACEINDEXING()
	registerCodeIndexHandlersAGENTSTATESETAUTOENABLEDEFAULT()
	registerCodeIndexHandlersAGENTSTATECLEARINDEXDATA()
}
