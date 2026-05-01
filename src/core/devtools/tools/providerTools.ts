import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { ClineProvider } from "../../webview/ClineProvider"
import { clearWebviewResources } from "../../features/foundation/window-manager/store"

/**
 * Registers provider-management MCP tools.
 *
 * These tools allow programmatic recovery of the webview/provider connection
 * without requiring manual VS Code interaction (e.g., clicking Refresh in MCP settings).
 */
export function registerProviderTools(mcpServer: McpServer, _bridge: any): void {
	mcpServer.tool(
		"restart_provider",
		"Attempt to restart the webview provider by clearing stale resources and re-initializing the view. Use this when the provider/webview connection is dead but the HTTP/MCP server is still alive.",
		{},
		async () => {
			const provider = ClineProvider.getVisibleInstance()

			if (!provider) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								ok: false,
								error: "No active provider instance found. The extension host may need to be reloaded.",
							}),
						},
					],
				}
			}

			try {
				console.log("[Jabberwock DevTools] restart_provider: clearing webview resources...")

				// Clear stale webview disposables (event listeners, etc.)
				clearWebviewResources(provider)

				// Re-initialize the webview if the view reference still exists
				if ((provider as any).view) {
					console.log("[Jabberwock DevTools] restart_provider: re-initializing webview view...")
					await provider.resolveWebviewView((provider as any).view)
				} else {
					console.log(
						"[Jabberwock DevTools] restart_provider: no view reference available, cannot re-initialize webview",
					)
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									ok: false,
									error: "Provider has no view reference. The extension host may need to be reloaded manually.",
								}),
							},
						],
					}
				}

				console.log("[Jabberwock DevTools] restart_provider: provider restarted successfully")

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								ok: true,
								message: "Provider webview resources cleared and view re-initialized.",
							}),
						},
					],
				}
			} catch (error: any) {
				console.error(`[Jabberwock DevTools] restart_provider: error: ${error.message}`)

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								ok: false,
								error: `Failed to restart provider: ${error.message}`,
							}),
						},
					],
				}
			}
		},
	)
}
