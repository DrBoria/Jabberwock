import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import { DIAGNOSTICS_CLEAR_DIAGNOSTICS, DIAGNOSTICS_DOWNLOAD_ERROR_DIAGNOSTICS } from "@features/settings"

function registerDiagnosticsHandlersDIAGNOSTICSCLEARDIAGNOSTICS(): void {
	onWebviewMessage(DIAGNOSTICS_CLEAR_DIAGNOSTICS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "diagnostics.clear",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerDiagnosticsHandlersDIAGNOSTICSDOWNLOADERRORDIAGNOSTICS(): void {
	onWebviewMessage(DIAGNOSTICS_DOWNLOAD_ERROR_DIAGNOSTICS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.diagnostics.download",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerDiagnosticsHandlers(_bus: IntentBus): void {
	registerDiagnosticsHandlersDIAGNOSTICSCLEARDIAGNOSTICS()
	registerDiagnosticsHandlersDIAGNOSTICSDOWNLOADERRORDIAGNOSTICS()
}
