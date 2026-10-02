import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	AGENT_STATE_UPDATE_VS_CODE_SETTING,
	AGENT_STATE_GET_VS_CODE_SETTING,
	AGENT_STATE_AUTO_APPROVAL_ENABLED,
	AGENT_STATE_DEBUG_SETTING,
} from "@features/settings"

function registerVscodeSettingsHandlersAGENTSTATEUPDATEVSCODESETTING(): void {
	onWebviewMessage(AGENT_STATE_UPDATE_VS_CODE_SETTING, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.vscode.setting.update",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerVscodeSettingsHandlersAGENTSTATEGETVSCODESETTING(): void {
	onWebviewMessage(AGENT_STATE_GET_VS_CODE_SETTING, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.vscode.setting.get",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerVscodeSettingsHandlersAGENTSTATEAUTOAPPROVALENABLED(): void {
	onWebviewMessage(AGENT_STATE_AUTO_APPROVAL_ENABLED, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.auto.approval.enabled",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerVscodeSettingsHandlersAGENTSTATEDEBUGSETTING(): void {
	onWebviewMessage(AGENT_STATE_DEBUG_SETTING, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.debug.setting",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerVscodeSettingsHandlers(_bus: IntentBus): void {
	registerVscodeSettingsHandlersAGENTSTATEUPDATEVSCODESETTING()
	registerVscodeSettingsHandlersAGENTSTATEGETVSCODESETTING()
	registerVscodeSettingsHandlersAGENTSTATEAUTOAPPROVALENABLED()
	registerVscodeSettingsHandlersAGENTSTATEDEBUGSETTING()
}
