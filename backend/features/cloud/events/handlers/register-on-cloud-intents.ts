import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import { registerOnCloud } from "@features/cloud"
import {
	CLOUD_CLOUD_BUTTON_CLICKED,
	CLOUD_JABBERWOCK_CLOUD_SIGN_IN,
	CLOUD_CLOUD_LANDING_PAGE_SIGN_IN,
	CLOUD_JABBERWOCK_CLOUD_SIGN_OUT,
	CLOUD_JABBERWOCK_CLOUD_MANUAL_URL,
	CLOUD_OPEN_AI_CODEX_SIGN_IN,
	CLOUD_OPEN_AI_CODEX_SIGN_OUT,
	CLOUD_SWITCH_ORGANIZATION,
	CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL,
} from "@features/cloud"

/**
 * Register all cloud event handlers on the IntentBus.
 */

function registerOnCloudCLOUDCLOUDBUTTONCLICKED(): void {
	onWebviewMessage(CLOUD_CLOUD_BUTTON_CLICKED, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.button.clicked",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnCloudCLOUDJABBERWOCKCLOUDSIGNIN(): void {
	onWebviewMessage(CLOUD_JABBERWOCK_CLOUD_SIGN_IN, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.sign.in",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnCloudCLOUDCLOUDLANDINGPAGESIGNIN(): void {
	onWebviewMessage(CLOUD_CLOUD_LANDING_PAGE_SIGN_IN, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.landing.page.sign.in",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnCloudCLOUDJABBERWOCKCLOUDSIGNOUT(): void {
	onWebviewMessage(CLOUD_JABBERWOCK_CLOUD_SIGN_OUT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.sign.out",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnCloudCLOUDJABBERWOCKCLOUDMANUALURL(): void {
	onWebviewMessage(CLOUD_JABBERWOCK_CLOUD_MANUAL_URL, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.manual.url",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnCloudCLOUDOPENAICODEXSIGNIN(): void {
	onWebviewMessage(CLOUD_OPEN_AI_CODEX_SIGN_IN, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.openai.codex.sign.in",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnCloudCLOUDOPENAICODEXSIGNOUT(): void {
	onWebviewMessage(CLOUD_OPEN_AI_CODEX_SIGN_OUT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.openai.codex.sign.out",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnCloudCLOUDSWITCHORGANIZATION(): void {
	onWebviewMessage(CLOUD_SWITCH_ORGANIZATION, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.switch.organization",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnCloudCLOUDCLEARCLOUDAUTHSKIPMODEL(): void {
	onWebviewMessage(CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.clear.auth.skip.model",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerOnCloudIntents(bus: IntentBus): void {
	registerOnCloud(bus)
	registerOnCloudCLOUDCLOUDBUTTONCLICKED()
	registerOnCloudCLOUDJABBERWOCKCLOUDSIGNIN()
	registerOnCloudCLOUDCLOUDLANDINGPAGESIGNIN()
	registerOnCloudCLOUDJABBERWOCKCLOUDSIGNOUT()
	registerOnCloudCLOUDJABBERWOCKCLOUDMANUALURL()
	registerOnCloudCLOUDOPENAICODEXSIGNIN()
	registerOnCloudCLOUDOPENAICODEXSIGNOUT()
	registerOnCloudCLOUDSWITCHORGANIZATION()
	registerOnCloudCLOUDCLEARCLOUDAUTHSKIPMODEL()
}
