import type { IntentBus } from "@features/intents/bus"
import { registerOnApiRequestStarted } from "./on-api-request-started"

/**
 * Register all API feature handlers on the given IntentBus.
 */
export function registerApiHandlers(bus: IntentBus): void {
	registerOnApiRequestStarted(bus)
}
