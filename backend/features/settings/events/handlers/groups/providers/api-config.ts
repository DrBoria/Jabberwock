import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	AGENT_STATE_SAVE_API_CONFIGURATION,
	AGENT_STATE_UPSERT_API_CONFIGURATION,
	AGENT_STATE_RENAME_API_CONFIGURATION,
	AGENT_STATE_DELETE_API_CONFIGURATION,
	AGENT_STATE_LOAD_API_CONFIGURATION,
	AGENT_STATE_LOAD_API_CONFIGURATION_BY_ID,
	AGENT_STATE_GET_LIST_API_CONFIGURATION,
	AGENT_STATE_LOCK_API_CONFIG_ACROSS_MODES,
	AGENT_STATE_ENHANCEMENT_API_CONFIG_ID,
} from "@features/settings"

function registerApiConfigHandlersAGENTSTATESAVEAPICONFIGURATION(): void {
	onWebviewMessage(AGENT_STATE_SAVE_API_CONFIGURATION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.save",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerApiConfigHandlersAGENTSTATEUPSERTAPICONFIGURATION(): void {
	onWebviewMessage(AGENT_STATE_UPSERT_API_CONFIGURATION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.upsert",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerApiConfigHandlersAGENTSTATERENAMEAPICONFIGURATION(): void {
	onWebviewMessage(AGENT_STATE_RENAME_API_CONFIGURATION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.rename",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerApiConfigHandlersAGENTSTATEDELETEAPICONFIGURATION(): void {
	onWebviewMessage(AGENT_STATE_DELETE_API_CONFIGURATION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.delete",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerApiConfigHandlersAGENTSTATELOADAPICONFIGURATION(): void {
	onWebviewMessage(AGENT_STATE_LOAD_API_CONFIGURATION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.load",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerApiConfigHandlersAGENTSTATELOADAPICONFIGURATIONBYID(): void {
	onWebviewMessage(AGENT_STATE_LOAD_API_CONFIGURATION_BY_ID, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.load.by.id",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerApiConfigHandlersAGENTSTATEGETLISTAPICONFIGURATION(): void {
	onWebviewMessage(AGENT_STATE_GET_LIST_API_CONFIGURATION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.list",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerApiConfigHandlersAGENTSTATELOCKAPICONFIGACROSSMODES(): void {
	onWebviewMessage(AGENT_STATE_LOCK_API_CONFIG_ACROSS_MODES, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.lock.modes",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerApiConfigHandlersAGENTSTATEENHANCEMENTAPICONFIGID(): void {
	onWebviewMessage(AGENT_STATE_ENHANCEMENT_API_CONFIG_ID, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.enhancement.id",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerApiConfigHandlers(_bus: IntentBus): void {
	registerApiConfigHandlersAGENTSTATESAVEAPICONFIGURATION()
	registerApiConfigHandlersAGENTSTATEUPSERTAPICONFIGURATION()
	registerApiConfigHandlersAGENTSTATERENAMEAPICONFIGURATION()
	registerApiConfigHandlersAGENTSTATEDELETEAPICONFIGURATION()
	registerApiConfigHandlersAGENTSTATELOADAPICONFIGURATION()
	registerApiConfigHandlersAGENTSTATELOADAPICONFIGURATIONBYID()
	registerApiConfigHandlersAGENTSTATEGETLISTAPICONFIGURATION()
	registerApiConfigHandlersAGENTSTATELOCKAPICONFIGACROSSMODES()
	registerApiConfigHandlersAGENTSTATEENHANCEMENTAPICONFIGID()
}
