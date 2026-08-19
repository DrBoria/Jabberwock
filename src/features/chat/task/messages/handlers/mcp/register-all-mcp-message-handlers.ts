import type { IntentBus } from "@features/intents/bus"
import { registerOnMcpToolResult } from "./on-tool-result"

/**
 * Register all MCP-related intent handlers on the bus.
 */
export function registerAllMcpMessageHandlers(bus: IntentBus): void {
	registerOnMcpToolResult(bus)
}
