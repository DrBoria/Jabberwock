import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	AGENT_STATE_UPDATE_PROMPT,
	AGENT_STATE_UPDATE_SYSTEM_PROMPT_TEMPLATE,
	AGENT_STATE_GET_SYSTEM_PROMPT,
	AGENT_STATE_COPY_SYSTEM_PROMPT,
	AGENT_STATE_CUSTOM_INSTRUCTIONS,
} from "@features/settings"

function registerPromptsHandlersAGENTSTATEUPDATEPROMPT(): void {
	onWebviewMessage(AGENT_STATE_UPDATE_PROMPT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.prompt.update",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerPromptsHandlersAGENTSTATEUPDATESYSTEMPROMPTTEMPLATE(): void {
	onWebviewMessage(AGENT_STATE_UPDATE_SYSTEM_PROMPT_TEMPLATE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.prompt.system.template.update",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerPromptsHandlersAGENTSTATEGETSYSTEMPROMPT(): void {
	onWebviewMessage(AGENT_STATE_GET_SYSTEM_PROMPT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.prompt.system.get",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerPromptsHandlersAGENTSTATECOPYSYSTEMPROMPT(): void {
	onWebviewMessage(AGENT_STATE_COPY_SYSTEM_PROMPT, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.prompt.system.copy",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerPromptsHandlersAGENTSTATECUSTOMINSTRUCTIONS(): void {
	onWebviewMessage(AGENT_STATE_CUSTOM_INSTRUCTIONS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.instructions.custom.update",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerPromptsHandlers(_bus: IntentBus): void {
	registerPromptsHandlersAGENTSTATEUPDATEPROMPT()
	registerPromptsHandlersAGENTSTATEUPDATESYSTEMPROMPTTEMPLATE()
	registerPromptsHandlersAGENTSTATEGETSYSTEMPROMPT()
	registerPromptsHandlersAGENTSTATECOPYSYSTEMPROMPT()
	registerPromptsHandlersAGENTSTATECUSTOMINSTRUCTIONS()
}
