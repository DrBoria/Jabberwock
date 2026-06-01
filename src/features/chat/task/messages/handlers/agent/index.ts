import type { IntentBus } from "../../../../../intents/bus"
import { registerOnAgentResponseReceived } from "./on-response-received"
import { registerOnAgentRequestFailed } from "./on-request-failed"
import { registerOnMessageBroadcast } from "./on-message-broadcast"

/**
 * Register all agent-message-related intent handlers on the bus.
 */
export function registerAllAgentMessageHandlers(bus: IntentBus): void {
	registerOnAgentResponseReceived(bus)
	registerOnAgentRequestFailed(bus)
	registerOnMessageBroadcast(bus)
}
