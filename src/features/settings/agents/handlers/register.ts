import type { IntentBus } from "@features/intents/bus"
import { registerOnModesFileChanged } from "./on-modes-file-changed"

/**
 * Register all settings/agents intent handlers on the bus.
 */
export function registerAllSettingsAgentsHandlers(bus: IntentBus): void {
	registerOnModesFileChanged(bus)
}
