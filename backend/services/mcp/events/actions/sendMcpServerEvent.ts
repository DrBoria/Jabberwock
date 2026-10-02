/**
 * MCP server event action creator.
 *
 * This is the ONLY code path that may send MCP server state-change events to
 * webview providers. No other code may call postMessageToWebview directly for
 * MCP server notifications.
 */

import type { ProviderHandle } from "@features/foundation/webview"

/**
 * Send an MCP server state-change event to a registered webview provider.
 */
export function sendMcpServerEvent(
	provider: ProviderHandle,
	message: { type: string; [key: string]: unknown },
): Promise<boolean> {
	return provider.postMessageToWebview(message)
}
