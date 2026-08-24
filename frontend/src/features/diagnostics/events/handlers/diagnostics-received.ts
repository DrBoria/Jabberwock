import type { IntentBus } from "../../../intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "../../../intents/context"
import { getRootStore } from "../../../root-store"
import type { DiagnosticSnapshot } from "@jabberwock/types"

/**
 * Register all frontend diagnostics event handlers on the IntentBus.
 */
export function registerOnFrontendDiagnosticsIntents(bus: IntentBus): void {
	bus.register(IntentConstants.diagnostics.RECEIVED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { diagnostics?: unknown }
		if (payload.diagnostics) {
			store.extensionState = { ...store.extensionState, diagnostics: payload.diagnostics as DiagnosticSnapshot }
		}
	})
}
