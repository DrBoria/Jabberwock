import * as vscode from "vscode" // v4 B2 (L6): kept for the showWarningMessage site — outside L12 error scope, moves with the connector in B3/B4
import delay from "delay"

import { t } from "@i18n"
import { fetchToolsList } from "@services/mcp/features/tools"
import { fetchResourcesList, fetchResourceTemplatesList } from "@services/mcp/features/resources"
// v4 B2 (L12): error toasts publish through the pubsub notification stream; host sink renders them.
import { publishNotificationError } from "@features/foundation/capabilities/notifications"

import type { McpHubState } from "@services/mcp/core/types"
import { findConnection, deleteConnection } from "@services/mcp/mcp-hub/connection/manager"
import { notifyWebviewOfServerChanges } from "@services/mcp/mcp-hub/notifications"
import { showErrorMessage, getProjectMcpPath, isMcpEnabled } from "@services/mcp/mcp-hub/init"

// ─── Handle MCP enabled change ───────────────────────────────────────

export async function handleMcpEnabledChange(
	state: McpHubState,
	enabled: boolean,
	refreshAllConnectionsFn: () => Promise<void>,
): Promise<void> {
	if (!enabled) {
		const existingConnections = [...state.connections]
		const disconnectionErrors: Array<{ serverName: string; error: string }> = []

		for (const conn of existingConnections) {
			try {
				await deleteConnection(state, conn.server.name, conn.server.source)
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				disconnectionErrors.push({
					serverName: conn.server.name,
					error: errorMessage,
				})
				console.error(`[jabberwock] Failed to disconnect MCP server ${conn.server.name}: ${errorMessage}`)
			}
		}

		if (disconnectionErrors.length > 0) {
			const errorSummary = disconnectionErrors.map((e) => `${e.serverName}: ${e.error}`).join("\n")
			vscode.window.showWarningMessage(
				t("mcp:errors.disconnect_servers_partial", {
					count: disconnectionErrors.length,
					errors: errorSummary,
				}),
			)
		}

		try {
			await refreshAllConnectionsFn()
		} catch (error) {
			console.error(`[jabberwock] Failed to refresh MCP connections after disabling: ${error}`)
			publishNotificationError(t("mcp:errors.refresh_after_disable"), error) // v4 B2 (L12): pubsub notification stream instead of vscode.window
		}
	} else {
		try {
			await refreshAllConnectionsFn()
		} catch (error) {
			console.error(`[jabberwock] Failed to refresh MCP connections after enabling: ${error}`)
			publishNotificationError(t("mcp:errors.refresh_after_enable"), error) // v4 B2 (L12): pubsub notification stream instead of vscode.window
		}
	}
}

// ─── Refresh all connections ─────────────────────────────────────────

export async function refreshAllConnections(
	state: McpHubState,
	getMcpSettingsFilePath: () => Promise<string>,
	initializeMcpServersFn: (source: "global" | "project") => Promise<void>,
): Promise<void> {
	if (state.isConnecting) {
		return
	}

	const mcpEnabled = await isMcpEnabled()
	if (!mcpEnabled) {
		const existingConnections = [...state.connections]
		for (const conn of existingConnections) {
			await deleteConnection(state, conn.server.name, conn.server.source)
		}

		await initializeMcpServersFn("global")
		await initializeMcpServersFn("project")

		await notifyWebviewOfServerChanges(state, getMcpSettingsFilePath, getProjectMcpPath)
		return
	}

	state.isConnecting = true

	try {
		await delay(100)
		await notifyWebviewOfServerChanges(state, getMcpSettingsFilePath, getProjectMcpPath)
	} catch (error) {
		showErrorMessage("Failed to refresh MCP servers", error)
	} finally {
		state.isConnecting = false
	}
}

// ─── Refresh server capabilities ─────────────────────────────────────

export async function refreshServerCapabilities(
	state: McpHubState,
	serverName: string,
	serverSource: "global" | "project",
	getMcpSettingsFilePath: () => Promise<string>,
): Promise<void> {
	try {
		const connection = findConnection(state, serverName, serverSource)
		if (!connection || connection.type !== "connected") {
			return
		}
		connection.server.tools = await fetchToolsList(
			serverName,
			serverSource,
			(name, s) => findConnection(state, name, s),
			getMcpSettingsFilePath,
			getProjectMcpPath,
		)
		connection.server.resources = await fetchResourcesList(serverName, serverSource, (name, s) =>
			findConnection(state, name, s),
		)
		connection.server.resourceTemplates = await fetchResourceTemplatesList(serverName, serverSource, (name, s) =>
			findConnection(state, name, s),
		)
	} catch (error) {
		console.error(`[jabberwock] Failed to refresh capabilities for ${serverName}:`, error)
	}
}
