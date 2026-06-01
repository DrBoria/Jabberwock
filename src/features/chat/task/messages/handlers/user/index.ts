import type { IntentBus } from "../../../../../intents/bus"
import { registerOnUserMessageReceived } from "./on-message-received"

/**
 * Register all user-message-related intent handlers on the bus.
 */
export function registerAllUserMessageHandlers(bus: IntentBus): void {
	registerOnUserMessageReceived(bus)
}
