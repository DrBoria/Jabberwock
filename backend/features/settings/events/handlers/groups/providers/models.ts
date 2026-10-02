import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	AGENT_STATE_REQUEST_ROUTER_MODELS,
	AGENT_STATE_REQUEST_OPEN_AI_MODELS,
	AGENT_STATE_REQUEST_OLLAMA_MODELS,
	AGENT_STATE_REQUEST_LM_STUDIO_MODELS,
	AGENT_STATE_REQUEST_ROO_MODELS,
	AGENT_STATE_REQUEST_ROO_CREDIT_BALANCE,
	AGENT_STATE_REQUEST_VS_CODE_LM_MODELS,
	AGENT_STATE_FLUSH_ROUTER_MODELS,
} from "@features/settings"

function registerModelsHandlersAGENTSTATEREQUESTROUTERMODELS(): void {
	onWebviewMessage(AGENT_STATE_REQUEST_ROUTER_MODELS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.models.router.request",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModelsHandlersAGENTSTATEREQUESTOPENAIMODELS(): void {
	onWebviewMessage(AGENT_STATE_REQUEST_OPEN_AI_MODELS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.models.openai.request",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModelsHandlersAGENTSTATEREQUESTOLLAMAMODELS(): void {
	onWebviewMessage(AGENT_STATE_REQUEST_OLLAMA_MODELS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.models.ollama.request",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModelsHandlersAGENTSTATEREQUESTLMSTUDIOMODELS(): void {
	onWebviewMessage(AGENT_STATE_REQUEST_LM_STUDIO_MODELS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.models.lmstudio.request",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModelsHandlersAGENTSTATEREQUESTROOMODELS(): void {
	onWebviewMessage(AGENT_STATE_REQUEST_ROO_MODELS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.models.roo.request",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModelsHandlersAGENTSTATEREQUESTROOCREDITBALANCE(): void {
	onWebviewMessage(AGENT_STATE_REQUEST_ROO_CREDIT_BALANCE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.models.roo.credit.balance",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModelsHandlersAGENTSTATEREQUESTVSCODELMMODELS(): void {
	onWebviewMessage(AGENT_STATE_REQUEST_VS_CODE_LM_MODELS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.models.vscode.lm.request",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerModelsHandlersAGENTSTATEFLUSHROUTERMODELS(): void {
	onWebviewMessage(AGENT_STATE_FLUSH_ROUTER_MODELS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.models.router.flush",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerModelsHandlers(_bus: IntentBus): void {
	registerModelsHandlersAGENTSTATEREQUESTROUTERMODELS()
	registerModelsHandlersAGENTSTATEREQUESTOPENAIMODELS()
	registerModelsHandlersAGENTSTATEREQUESTOLLAMAMODELS()
	registerModelsHandlersAGENTSTATEREQUESTLMSTUDIOMODELS()
	registerModelsHandlersAGENTSTATEREQUESTROOMODELS()
	registerModelsHandlersAGENTSTATEREQUESTROOCREDITBALANCE()
	registerModelsHandlersAGENTSTATEREQUESTVSCODELMMODELS()
	registerModelsHandlersAGENTSTATEFLUSHROUTERMODELS()
}
