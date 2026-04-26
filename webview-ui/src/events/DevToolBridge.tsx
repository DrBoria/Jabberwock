/**
 * DevToolBridge — React component that syncs devtool MCP queries to EventBus.
 *
 * When the jabberwock devtool calls getDom / get_active_ask / get_current_state,
 * this component ensures the EventBus has the latest data so the devtool
 * response is always consistent with what the DOM renders.
 *
 * Mount once at the App level.
 */

import { useEffect } from "react"
import { eventBus, type AskEvent, type McpServerRequestEvent } from "./EventBus"

/**
 * Expose current ask state on window for devtool inspection.
 * The devtool's get_current_state can read this synchronously.
 */
export function DevToolBridge() {
	useEffect(() => {
		const unsubAsk = eventBus.subscribe("ASK_RECEIVED", (data) => {
			;(window as unknown as Record<string, unknown>).__JABBERWOCK_LAST_ASK__ = data
		})

		const unsubMcp = eventBus.subscribe("MCP_SERVER_REQUEST", (data) => {
			;(window as unknown as Record<string, unknown>).__JABBERWOCK_LAST_MCP_REQUEST__ = data
		})

		const unsubState = eventBus.subscribe("STATE_CHANGED", (data) => {
			;(window as unknown as Record<string, unknown>).__JABBERWOCK_LAST_STATE_CHANGE__ = data
		})

		return () => {
			unsubAsk()
			unsubMcp()
			unsubState()
			delete (window as unknown as Record<string, unknown>).__JABBERWOCK_LAST_ASK__
			delete (window as unknown as Record<string, unknown>).__JABBERWOCK_LAST_MCP_REQUEST__
			delete (window as unknown as Record<string, unknown>).__JABBERWOCK_LAST_STATE_CHANGE__
		}
	}, [])

	return null
}

/**
 * Helper to get the current ask from EventBus (for devtool queries).
 */
export function getCurrentAsk(): AskEvent | undefined {
	return eventBus.getLastEvent("ASK_RECEIVED") as AskEvent | undefined
}

/**
 * Helper to get the current MCP server request from EventBus.
 */
export function getCurrentMcpRequest(): McpServerRequestEvent | undefined {
	return eventBus.getLastEvent("MCP_SERVER_REQUEST") as McpServerRequestEvent | undefined
}
