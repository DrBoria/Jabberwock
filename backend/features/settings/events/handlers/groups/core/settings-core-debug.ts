import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	SETTINGS_INSERT_TEXT_INTO_TEXTAREA,
	SETTINGS_REQUEST_OPEN_AI_CODEX_RATE_LIMITS,
	SETTINGS_OPEN_DEBUG_API_HISTORY,
	SETTINGS_OPEN_DEBUG_UI_HISTORY,
	SETTINGS_TOGGLE_API_CONFIG_PIN,
	SETTINGS_SET_API_CONFIG_PASSWORD,
	SETTINGS_REQUEST_MODES,
	SETTINGS_DEVTOOL_STATUS,
	SETTINGS_WEBVIEW_LOG,
	SETTINGS_DOM_RESPONSE,
	SETTINGS_WEBVIEW_ERROR,
	SETTINGS_FETCH_URL,
	SETTINGS_LOCATOR_OPEN_FILE,
	SETTINGS_LOCATOR_TARGET,
} from "@features/settings"

function registerSettingsCoreDebugHandlersSETTINGSINSERTTEXTINTOTEXTAREA(): void {
	onWebviewMessage(SETTINGS_INSERT_TEXT_INTO_TEXTAREA, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.textarea.text.insert",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSREQUESTOPENAICODEXRATELIMITS(): void {
	onWebviewMessage(SETTINGS_REQUEST_OPEN_AI_CODEX_RATE_LIMITS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.openai.codex.rate.limits",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSOPENDEBUGAPIHISTORY(): void {
	onWebviewMessage(SETTINGS_OPEN_DEBUG_API_HISTORY, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.debug.api.history.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSOPENDEBUGUIHISTORY(): void {
	onWebviewMessage(SETTINGS_OPEN_DEBUG_UI_HISTORY, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.debug.ui.history.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSTOGGLEAPICONFIGPIN(): void {
	onWebviewMessage(SETTINGS_TOGGLE_API_CONFIG_PIN, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.pin.toggle",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSSETAPICONFIGPASSWORD(): void {
	onWebviewMessage(SETTINGS_SET_API_CONFIG_PASSWORD, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.api.config.password.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSREQUESTMODES(): void {
	onWebviewMessage(SETTINGS_REQUEST_MODES, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.modes.request",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSDEVTOOLSTATUS(): void {
	onWebviewMessage(SETTINGS_DEVTOOL_STATUS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.devtool.status",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSWEBVIEWLOG(): void {
	onWebviewMessage(SETTINGS_WEBVIEW_LOG, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.webview.log",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSDOMRESPONSE(): void {
	onWebviewMessage(SETTINGS_DOM_RESPONSE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.webview.dom.response",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSWEBVIEWERROR(): void {
	onWebviewMessage(SETTINGS_WEBVIEW_ERROR, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.webview.error",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSFETCHURL(): void {
	onWebviewMessage(SETTINGS_FETCH_URL, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.webview.url.fetch",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSLOCATOROPENFILE(): void {
	onWebviewMessage(SETTINGS_LOCATOR_OPEN_FILE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.locator.file.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsCoreDebugHandlersSETTINGSLOCATORTARGET(): void {
	onWebviewMessage(SETTINGS_LOCATOR_TARGET, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.locator.target.set",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerSettingsCoreDebugHandlers(_bus: IntentBus): void {
	registerSettingsCoreDebugHandlersSETTINGSINSERTTEXTINTOTEXTAREA()
	registerSettingsCoreDebugHandlersSETTINGSREQUESTOPENAICODEXRATELIMITS()
	registerSettingsCoreDebugHandlersSETTINGSOPENDEBUGAPIHISTORY()
	registerSettingsCoreDebugHandlersSETTINGSOPENDEBUGUIHISTORY()
	registerSettingsCoreDebugHandlersSETTINGSTOGGLEAPICONFIGPIN()
	registerSettingsCoreDebugHandlersSETTINGSSETAPICONFIGPASSWORD()
	registerSettingsCoreDebugHandlersSETTINGSREQUESTMODES()
	registerSettingsCoreDebugHandlersSETTINGSDEVTOOLSTATUS()
	registerSettingsCoreDebugHandlersSETTINGSWEBVIEWLOG()
	registerSettingsCoreDebugHandlersSETTINGSDOMRESPONSE()
	registerSettingsCoreDebugHandlersSETTINGSWEBVIEWERROR()
	registerSettingsCoreDebugHandlersSETTINGSFETCHURL()
	registerSettingsCoreDebugHandlersSETTINGSLOCATOROPENFILE()
	registerSettingsCoreDebugHandlersSETTINGSLOCATORTARGET()
}
