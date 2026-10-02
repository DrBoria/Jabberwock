import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	SETTINGS_UPDATE_SETTINGS,
	SETTINGS_DID_SHOW_ANNOUNCEMENT,
	SETTINGS_GET_DISMISSED_UPSELLS,
	SETTINGS_DISMISS_UPSELL,
	SETTINGS_OPEN_KEYBOARD_SHORTCUTS,
	SETTINGS_OPEN_MARKDOWN_PREVIEW,
	SETTINGS_TELEMETRY_SETTING,
	SETTINGS_TERMINAL_OPERATION,
	SETTINGS_SHOW_MDM_AUTH_REQUIRED_NOTIFICATION,
	SETTINGS_ALLOWED_COMMANDS,
	SETTINGS_DENIED_COMMANDS,
	SETTINGS_OPEN_COMMAND_FILE,
	SETTINGS_DELETE_COMMAND,
	SETTINGS_CREATE_COMMAND,
} from "@features/settings"

function registerSettingsCoreUiHandlersSETTINGSUPDATESETTINGS(): void {
	onWebviewMessage(SETTINGS_UPDATE_SETTINGS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.update",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSDIDSHOWANNOUNCEMENT(): void {
	onWebviewMessage(SETTINGS_DID_SHOW_ANNOUNCEMENT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.announcement.shown",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSGETDISMISSEDUPSELLS(): void {
	onWebviewMessage(SETTINGS_GET_DISMISSED_UPSELLS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.upsells.dismissed.get",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSDISMISSUPSELL(): void {
	onWebviewMessage(SETTINGS_DISMISS_UPSELL, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.upsell.dismiss",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSOPENKEYBOARDSHORTCUTS(): void {
	onWebviewMessage(SETTINGS_OPEN_KEYBOARD_SHORTCUTS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.keyboard.shortcuts.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSOPENMARKDOWNPREVIEW(): void {
	onWebviewMessage(SETTINGS_OPEN_MARKDOWN_PREVIEW, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.markdown.preview.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSTELEMETRYSETTING(): void {
	onWebviewMessage(SETTINGS_TELEMETRY_SETTING, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.telemetry.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSTERMINALOPERATION(): void {
	onWebviewMessage(SETTINGS_TERMINAL_OPERATION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.terminal.operation.action",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSSHOWMDMAUTHREQUIREDNOTIFICATION(): void {
	onWebviewMessage(SETTINGS_SHOW_MDM_AUTH_REQUIRED_NOTIFICATION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mdm.auth.notification",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSALLOWEDCOMMANDS(): void {
	onWebviewMessage(SETTINGS_ALLOWED_COMMANDS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.commands.allowed.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSDENIEDCOMMANDS(): void {
	onWebviewMessage(SETTINGS_DENIED_COMMANDS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.commands.denied.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSOPENCOMMANDFILE(): void {
	onWebviewMessage(SETTINGS_OPEN_COMMAND_FILE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.commands.file.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSDELETECOMMAND(): void {
	onWebviewMessage(SETTINGS_DELETE_COMMAND, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.commands.delete",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreUiHandlersSETTINGSCREATECOMMAND(): void {
	onWebviewMessage(SETTINGS_CREATE_COMMAND, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.commands.create",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerSettingsCoreUiHandlers(_bus: IntentBus): void {
	registerSettingsCoreUiHandlersSETTINGSUPDATESETTINGS()
	registerSettingsCoreUiHandlersSETTINGSDIDSHOWANNOUNCEMENT()
	registerSettingsCoreUiHandlersSETTINGSGETDISMISSEDUPSELLS()
	registerSettingsCoreUiHandlersSETTINGSDISMISSUPSELL()
	registerSettingsCoreUiHandlersSETTINGSOPENKEYBOARDSHORTCUTS()
	registerSettingsCoreUiHandlersSETTINGSOPENMARKDOWNPREVIEW()
	registerSettingsCoreUiHandlersSETTINGSTELEMETRYSETTING()
	registerSettingsCoreUiHandlersSETTINGSTERMINALOPERATION()
	registerSettingsCoreUiHandlersSETTINGSSHOWMDMAUTHREQUIREDNOTIFICATION()
	registerSettingsCoreUiHandlersSETTINGSALLOWEDCOMMANDS()
	registerSettingsCoreUiHandlersSETTINGSDENIEDCOMMANDS()
	registerSettingsCoreUiHandlersSETTINGSOPENCOMMANDFILE()
	registerSettingsCoreUiHandlersSETTINGSDELETECOMMAND()
	registerSettingsCoreUiHandlersSETTINGSCREATECOMMAND()
}
