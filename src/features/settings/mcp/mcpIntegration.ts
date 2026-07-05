import type { ITaskModel } from "@features/chat/task/store"
import { McpHub } from "@services/mcp/core/McpHub"
import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { countEnabledMcpTools } from "@jabberwock/types"
import { getSettingsAccess } from "@utils/settings"
import { sendShowInteractiveApp } from "@features/settings/events/actions/sendSettingsEvent"

/** Typed helper to access Task-only `pendingElicitationResolve` on an ITaskModel. */
import * as vscode from "vscode"
import { getProvider } from "@features/foundation/webview/providerRegistry"

function getTaskForElicitation(
	task: ITaskModel,
): ITaskModel & { pendingElicitationResolve?: (data: { [key: string]: unknown }) => void } {
	return task as ITaskModel & { pendingElicitationResolve?: (data: { [key: string]: unknown }) => void }
}

/**
 * Gets the count of enabled MCP tools and servers.
 */
export async function getEnabledMcpToolsCount(
	task: ITaskModel,
): Promise<{ enabledToolCount: number; enabledServerCount: number }> {
	try {
		const provider = getProvider()

		const { mcpEnabled } = getSettingsAccess().getValues()
		if (!(mcpEnabled ?? true)) {
			return { enabledToolCount: 0, enabledServerCount: 0 }
		}

		const mcpHub = await getMcpServerManager().getInstance(provider.context as vscode.ExtensionContext, provider)
		if (!mcpHub) {
			return { enabledToolCount: 0, enabledServerCount: 0 }
		}

		// Set up listeners for elicitation UI
		setupMcpHubListeners(task, mcpHub)

		const servers = mcpHub.getServers()
		return countEnabledMcpTools(servers)
	} catch (error) {
		console.error("[jabberwock] [Task#getEnabledMcpToolsCount] Error counting MCP tools:", error)
		return { enabledToolCount: 0, enabledServerCount: 0 }
	}
}

/**
 * Sets up listeners on the MCP hub for elicitation UI interactions.
 */
export function setupMcpHubListeners(task: ITaskModel, mcpHub: McpHub) {
	// Only attach listener if it's not already attached to avoid duplicates
	if (mcpHub.listenerCount("interactiveUiRequested") === 0) {
		mcpHub.on(
			"interactiveUiRequested",
			async (args: { uri: string; resolve: (data: unknown) => void; reject: (err: Error) => void }) => {
				const { uri, resolve, reject: _reject } = args
				// Pause LLM execution and show interactive UI in Webview
				console.log("[Jabberwock] Handling interactiveUiRequested for URI:", uri)

				// Keep track of the resolve function so we can call it when user finishes
				getTaskForElicitation(task).pendingElicitationResolve = resolve

				// Send message to Webview to render the Iframe
				sendShowInteractiveApp(uri)
			},
		)
	}
}

/**
 * Resolves a pending elicitation with the provided data.
 */
export function resolveElicitation(task: ITaskModel, data: { [key: string]: unknown }) {
	const taskWithElicitation = getTaskForElicitation(task)
	if (taskWithElicitation.pendingElicitationResolve) {
		taskWithElicitation.pendingElicitationResolve(data)
		taskWithElicitation.pendingElicitationResolve = undefined
	}
}
