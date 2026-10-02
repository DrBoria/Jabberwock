import type { IntentBus } from "@src/features/intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "@src/features/intents/context"
import { getRootStore } from "@src/features/root-store"
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
