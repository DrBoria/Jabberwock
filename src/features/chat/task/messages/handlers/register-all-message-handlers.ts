import type { IntentBus } from "@features/intents/bus"
import { registerAllUserMessageHandlers } from "./user"
import { registerAllAgentMessageHandlers } from "./agent"
import { registerAllMcpMessageHandlers } from "./mcp"
import { registerOnSendMessageRequested } from "./on-send-message-requested"
import { registerOnMessageDeleteRequested } from "./on-message-delete-requested"
import { registerOnMessageDeleteConfirmed } from "./on-message-delete-confirmed"
import { registerOnMessageEditRequested } from "./on-message-edit-requested"
import { registerOnMessageEditConfirmed } from "./on-message-edit-confirmed"

/**
 * Register all message-related intent handlers on the bus.
 */
export function registerAllMessageHandlers(bus: IntentBus): void {
	registerAllUserMessageHandlers(bus)
	registerAllAgentMessageHandlers(bus)
	registerAllMcpMessageHandlers(bus)
	registerOnSendMessageRequested(bus)
	registerOnMessageDeleteRequested(bus)
	registerOnMessageDeleteConfirmed(bus)
	registerOnMessageEditRequested(bus)
	registerOnMessageEditConfirmed(bus)
}
