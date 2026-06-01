import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { postMessageToWebview } from "../store"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

/**
 * Handles foundation.tab.switch intent — switches the active tab.
 */
export function registerOnTabSwitch(bus: IntentBus): void {
	bus.register(IntentType.FoundationTabSwitch, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { tab: string; values?: { [key: string]: unknown }; fromMCP?: boolean }

		if (payload.tab) {
			if (hasTelemetryService() && !payload.fromMCP) {
				getTelemetryService().captureTabShown(payload.tab)
			}

			await postMessageToWebview(provider, {
				type: "action",
				action: "switchTab",
				tab: payload.tab,
				values: payload.values,
				fromMCP: payload.fromMCP === true,
			})
		}
	})
}
