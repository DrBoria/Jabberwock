import type { IntentBus } from "@features/intents/bus"
import { registerOnContextManagementRequired } from "./on-context-management-required"
import { registerOnContextWindowExceeded } from "./on-context-window-exceeded"
import { registerOnFileContextTracked } from "./on-context-tracked"

/**
 * Register all context-management-related intent handlers on the bus.
 */
export function registerAllContextManagementHandlers(bus: IntentBus): void {
	registerOnContextManagementRequired(bus)
	registerOnContextWindowExceeded(bus)
	registerOnFileContextTracked(bus)
}
