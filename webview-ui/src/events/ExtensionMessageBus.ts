/**
 * ExtensionMessageBus — bridges window "message" events to EventBus.
 *
 * Listens to all postMessage events from the extension host and
 * publishes typed events to the EventBus. React components subscribe
 * to EventBus instead of adding raw window listeners.
 */

import { eventBus, type AskEvent, type McpServerRequestEvent } from "./EventBus"

export function initExtensionMessageBus(): () => void {
	const handleMessage = (event: MessageEvent) => {
		const message = event.data
		if (!message || typeof message !== "object") return

		// Forward state updates
		if (message.type === "state") {
			eventBus.publish("STATE_CHANGED", { key: "fullState", value: message.state })
			return
		}

		// Forward action messages
		if (message.type === "action") {
			eventBus.publish("STATE_CHANGED", { key: "action", value: message.action })
			return
		}

		// Detect ask messages from the last clineMessage
		if (message.type === "state" && message.state?.clineMessages?.length) {
			const msgs = message.state.clineMessages
			const last = msgs[msgs.length - 1]
			if (last?.type === "ask") {
				const askEvent: AskEvent = {
					type: last.ask || "unknown",
					messageTs: last.ts,
					text: last.text || "",
					isPartial: last.partial || false,
				}
				eventBus.publish("ASK_RECEIVED", askEvent)

				// Special handling for use_mcp_server
				if (last.ask === "use_mcp_server") {
					try {
						const parsed = JSON.parse(last.text || "{}")
						const mcpEvent: McpServerRequestEvent = {
							serverName: parsed.serverName || parsed.server?.name || "unknown",
							toolName: parsed.tool?.name || parsed.toolName,
							params: parsed.tool?.params || parsed.params,
							response: parsed.response,
						}
						eventBus.publish("MCP_SERVER_REQUEST", mcpEvent)
					} catch {
						// Non-JSON text, skip MCP event
					}
				}
			}
		}

		// Forward MCP server list updates
		if (message.type === "mcpServers") {
			eventBus.publish("STATE_CHANGED", { key: "mcpServers", value: message.mcpServers })
		}
	}

	window.addEventListener("message", handleMessage)

	return () => {
		window.removeEventListener("message", handleMessage)
	}
}
