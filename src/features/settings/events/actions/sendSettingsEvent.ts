/**
 * Settings event action creators.
 *
 * These are the ONLY code paths that may send settings-related events
 * (MCP servers, API config, theme, task history) to the webview.
 * No other code may import or call postMessageToWebview directly.
 */

import { getProvider } from "@features/foundation/webview/providerRegistry"
import { postMessageToWebview } from "@features/foundation/window-manager/store"

/**
 * Send updated MCP server list to the webview.
 */
export function sendMcpServers(mcpServers: unknown): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "mcpServers", mcpServers })
}

/**
 * Send updated API config list to the webview.
 */
export function sendListApiConfig(listApiConfig: unknown): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "listApiConfig", listApiConfig })
}

/**
 * Send the current theme to the webview.
 */
export function sendTheme(text: string): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "theme", text })
}

/**
 * Send updated task history to the webview.
 */
export function sendTaskHistoryUpdated(taskHistory: unknown): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "taskHistoryUpdated", taskHistory })
}

/**
 * Send an incremental task history item update to the webview.
 */
export function sendTaskHistoryItemUpdated(historyItem: unknown): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "taskHistoryItemUpdated", historyItem })
}

/**
 * Send a request to the webview to show an interactive MCP app.
 */
export function sendShowInteractiveApp(uri: string): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "showInteractiveApp", uri })
}
