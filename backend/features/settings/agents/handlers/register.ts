import type { IntentBus } from "@features/intents"
import { registerOnModesFileChanged } from "./on-modes-file-changed"

/**
 * Register all settings/agents intent handlers on the bus.
 */
export function registerAllSettingsAgentsHandlers(bus: IntentBus): void {
	registerOnModesFileChanged(bus)
}
