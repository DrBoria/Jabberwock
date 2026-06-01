import type { IntentBus } from "../../intents/bus"
import { registerOnCloud } from "./on-cloud"

/**
 * Register all cloud-related intent handlers on the bus.
 */
export function registerAllCloudHandlers(bus: IntentBus): void {
	registerOnCloud(bus)
}
