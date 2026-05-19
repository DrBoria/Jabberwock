import type { Task } from "../Task"
import { McpHub } from "../../../../services/mcp/McpHub"
import { getMcpServerManager } from "../../../../services/mcp/McpServerManager"
import { countEnabledMcpTools } from "@jabberwock/types"

/**
 * Gets the count of enabled MCP tools and servers.
 */
export async function getEnabledMcpToolsCount(
	task: Task,
): Promise<{ enabledToolCount: number; enabledServerCount: number }> {
	try {
		const provider = task.providerRef.deref()
		if (!provider) {
			return { enabledToolCount: 0, enabledServerCount: 0 }
		}

		const { mcpEnabled } = (await provider.getState()) ?? {}
		if (!(mcpEnabled ?? true)) {
			return { enabledToolCount: 0, enabledServerCount: 0 }
		}

		const mcpHub = await getMcpServerManager().getInstance(provider.context, provider)
		if (!mcpHub) {
			return { enabledToolCount: 0, enabledServerCount: 0 }
		}

		// Set up listeners for elicitation UI
		setupMcpHubListeners(task, mcpHub)

		const servers = mcpHub.getServers()
		return countEnabledMcpTools(servers)
	} catch (error) {
		console.error("[Task#getEnabledMcpToolsCount] Error counting MCP tools:", error)
		return { enabledToolCount: 0, enabledServerCount: 0 }
	}
}

/**
 * Sets up listeners on the MCP hub for elicitation UI interactions.
 */
export function setupMcpHubListeners(task: Task, mcpHub: McpHub) {
	// Only attach listener if it's not already attached to avoid duplicates
	if (mcpHub.listenerCount("interactiveUiRequested") === 0) {
		mcpHub.on(
			"interactiveUiRequested",
			async (args: { uri: string; resolve: (data: unknown) => void; reject: (err: Error) => void }) => {
				const { uri, resolve, reject } = args
				// Pause LLM execution and show interactive UI in Webview
				console.log("[Jabberwock] Handling interactiveUiRequested for URI:", uri)

				// Keep track of the resolve function so we can call it when user finishes
				task.pendingElicitationResolve = resolve

				// Send message to Webview to render the Iframe
				await task.providerRef.deref()?.postMessageToWebview({
					type: "showInteractiveApp",
					uri: uri,
				})
			},
		)
	}
}

/**
 * Resolves a pending elicitation with the provided data.
 */
export function resolveElicitation(task: Task, data: Record<string, unknown>) {
	if (task.pendingElicitationResolve) {
		task.pendingElicitationResolve(data)
		task.pendingElicitationResolve = undefined
	}
}
