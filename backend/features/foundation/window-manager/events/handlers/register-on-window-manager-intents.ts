import type { IntentBus } from "@features/intents"
import { registerAllFoundationHandlers } from "@features/foundation"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import { registerOnShowTask } from "./on-show-task"
import {
	WINDOW_MANAGER_FOCUS_PANEL_REQUEST,
	WINDOW_MANAGER_SWITCH_TAB,
	WINDOW_MANAGER_ACTIVE_PAGE_RESPONSE,
	WINDOW_MANAGER_REQUEST_STATE,
	WINDOW_MANAGER_GET_TASK_WITH_AGGREGATED_COSTS,
	WINDOW_MANAGER_DELETE_TASK_WITH_ID,
	WINDOW_MANAGER_EXPORT_TASK_WITH_ID,
	WINDOW_MANAGER_EXPORT_CURRENT_TASK,
	WINDOW_MANAGER_DELETE_MULTIPLE_TASKS_WITH_IDS,
} from "@features/foundation"

function registerOnWindowManagerWINDOWMANAGERFOCUSPANELREQUEST(): void {
	onWebviewMessage(WINDOW_MANAGER_FOCUS_PANEL_REQUEST, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.focus.panel.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnWindowManagerWINDOWMANAGERSWITCHTAB(): void {
	onWebviewMessage(WINDOW_MANAGER_SWITCH_TAB, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.tab.switch",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnWindowManagerWINDOWMANAGERACTIVEPAGERESPONSE(): void {
	onWebviewMessage(WINDOW_MANAGER_ACTIVE_PAGE_RESPONSE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.active.page.response",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnWindowManagerWINDOWMANAGERREQUESTSTATE(): void {
	onWebviewMessage(WINDOW_MANAGER_REQUEST_STATE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.state.requested",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnWindowManagerWINDOWMANAGERGETTASKWITHAGGREGATEDCOSTS(): void {
	onWebviewMessage(WINDOW_MANAGER_GET_TASK_WITH_AGGREGATED_COSTS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.aggregated.costs",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnWindowManagerWINDOWMANAGERDELETETASKWITHID(): void {
	onWebviewMessage(WINDOW_MANAGER_DELETE_TASK_WITH_ID, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.delete",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnWindowManagerWINDOWMANAGEREXPORTTASKWITHID(): void {
	onWebviewMessage(WINDOW_MANAGER_EXPORT_TASK_WITH_ID, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.export",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnWindowManagerWINDOWMANAGEREXPORTCURRENTTASK(): void {
	onWebviewMessage(WINDOW_MANAGER_EXPORT_CURRENT_TASK, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.export.current",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnWindowManagerWINDOWMANAGERDELETEMULTIPLETASKSWITHIDS(): void {
	onWebviewMessage(WINDOW_MANAGER_DELETE_MULTIPLE_TASKS_WITH_IDS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "foundation.task.delete.multiple",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerOnWindowManagerIntents(bus: IntentBus): void {
	registerAllFoundationHandlers(bus)
	registerOnShowTask()
	registerOnWindowManagerWINDOWMANAGERFOCUSPANELREQUEST()
	registerOnWindowManagerWINDOWMANAGERSWITCHTAB()
	registerOnWindowManagerWINDOWMANAGERACTIVEPAGERESPONSE()
	registerOnWindowManagerWINDOWMANAGERREQUESTSTATE()
	registerOnWindowManagerWINDOWMANAGERGETTASKWITHAGGREGATEDCOSTS()
	registerOnWindowManagerWINDOWMANAGERDELETETASKWITHID()
	registerOnWindowManagerWINDOWMANAGEREXPORTTASKWITHID()
	registerOnWindowManagerWINDOWMANAGEREXPORTCURRENTTASK()
	registerOnWindowManagerWINDOWMANAGERDELETEMULTIPLETASKSWITHIDS()
}
