import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	SETTINGS_OPEN_MCP_SETTINGS,
	SETTINGS_OPEN_PROJECT_MCP_SETTINGS,
	SETTINGS_DELETE_MCP_SERVER,
	SETTINGS_RESTART_MCP_SERVER,
	SETTINGS_TOGGLE_TOOL_ALWAYS_ALLOW,
	SETTINGS_TOGGLE_TOOL_ENABLED_FOR_PROMPT,
	SETTINGS_TOGGLE_MCP_SERVER,
	SETTINGS_UPDATE_MCP_TIMEOUT,
	SETTINGS_REFRESH_ALL_MCP_SERVERS,
} from "@features/settings"

function registerSettingsMcpHandlersSETTINGSOPENMCPSETTINGS(): void {
	onWebviewMessage(SETTINGS_OPEN_MCP_SETTINGS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mcp.settings.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsMcpHandlersSETTINGSOPENPROJECTMCPSETTINGS(): void {
	onWebviewMessage(SETTINGS_OPEN_PROJECT_MCP_SETTINGS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mcp.project.settings.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsMcpHandlersSETTINGSDELETEMCPSERVER(): void {
	onWebviewMessage(SETTINGS_DELETE_MCP_SERVER, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mcp.server.delete",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsMcpHandlersSETTINGSRESTARTMCPSERVER(): void {
	onWebviewMessage(SETTINGS_RESTART_MCP_SERVER, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mcp.server.restart",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsMcpHandlersSETTINGSTOGGLETOOLALWAYSALLOW(): void {
	onWebviewMessage(SETTINGS_TOGGLE_TOOL_ALWAYS_ALLOW, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mcp.tool.always.allow",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsMcpHandlersSETTINGSTOGGLETOOLENABLEDFORPROMPT(): void {
	onWebviewMessage(SETTINGS_TOGGLE_TOOL_ENABLED_FOR_PROMPT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mcp.tool.enabled.for.prompt",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsMcpHandlersSETTINGSTOGGLEMCPSERVER(): void {
	onWebviewMessage(SETTINGS_TOGGLE_MCP_SERVER, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mcp.server.toggle",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsMcpHandlersSETTINGSUPDATEMCPTIMEOUT(): void {
	onWebviewMessage(SETTINGS_UPDATE_MCP_TIMEOUT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mcp.timeout.update",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsMcpHandlersSETTINGSREFRESHALLMCPSERVERS(): void {
	onWebviewMessage(SETTINGS_REFRESH_ALL_MCP_SERVERS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.mcp.servers.refresh",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerSettingsMcpHandlers(_bus: IntentBus): void {
	registerSettingsMcpHandlersSETTINGSOPENMCPSETTINGS()
	registerSettingsMcpHandlersSETTINGSOPENPROJECTMCPSETTINGS()
	registerSettingsMcpHandlersSETTINGSDELETEMCPSERVER()
	registerSettingsMcpHandlersSETTINGSRESTARTMCPSERVER()
	registerSettingsMcpHandlersSETTINGSTOGGLETOOLALWAYSALLOW()
	registerSettingsMcpHandlersSETTINGSTOGGLETOOLENABLEDFORPROMPT()
	registerSettingsMcpHandlersSETTINGSTOGGLEMCPSERVER()
	registerSettingsMcpHandlersSETTINGSUPDATEMCPTIMEOUT()
	registerSettingsMcpHandlersSETTINGSREFRESHALLMCPSERVERS()
}
