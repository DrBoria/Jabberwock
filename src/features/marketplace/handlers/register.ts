import type { IntentBus } from "@features/intents/bus"
import { registerOnMarketplace } from "./on-marketplace"

/**
 * Register all marketplace-related intent handlers on the bus.
 */
export function registerAllMarketplaceHandlers(bus: IntentBus): void {
	registerOnMarketplace(bus)
}
