import type { IntentBus } from "@features/intents"
import { registerOnHistory } from "./on-history"

/**
 * Register all history-related intent handlers on the bus.
 */
export function registerAllHistoryHandlers(bus: IntentBus): void {
	registerOnHistory(bus)
}
