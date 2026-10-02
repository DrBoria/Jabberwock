import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	SETTINGS_OPEN_IMAGE,
	SETTINGS_SAVE_IMAGE,
	SETTINGS_OPEN_FILE,
	SETTINGS_READ_FILE_CONTENT,
	SETTINGS_OPEN_EXTERNAL,
	SETTINGS_OPEN_MENTION,
} from "@features/settings"

function registerSettingsFilesHandlersSETTINGSOPENIMAGE(): void {
	onWebviewMessage(SETTINGS_OPEN_IMAGE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.file.image.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsFilesHandlersSETTINGSSAVEIMAGE(): void {
	onWebviewMessage(SETTINGS_SAVE_IMAGE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.file.image.save",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsFilesHandlersSETTINGSOPENFILE(): void {
	onWebviewMessage(SETTINGS_OPEN_FILE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.file.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsFilesHandlersSETTINGSREADFILECONTENT(): void {
	onWebviewMessage(SETTINGS_READ_FILE_CONTENT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.file.content.read",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsFilesHandlersSETTINGSOPENEXTERNAL(): void {
	onWebviewMessage(SETTINGS_OPEN_EXTERNAL, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.file.external.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerSettingsFilesHandlersSETTINGSOPENMENTION(): void {
	onWebviewMessage(SETTINGS_OPEN_MENTION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.file.mention.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerSettingsFilesHandlers(_bus: IntentBus): void {
	registerSettingsFilesHandlersSETTINGSOPENIMAGE()
	registerSettingsFilesHandlersSETTINGSSAVEIMAGE()
	registerSettingsFilesHandlersSETTINGSOPENFILE()
	registerSettingsFilesHandlersSETTINGSREADFILECONTENT()
	registerSettingsFilesHandlersSETTINGSOPENEXTERNAL()
	registerSettingsFilesHandlersSETTINGSOPENMENTION()
}
