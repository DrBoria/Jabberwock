import * as vscode from "vscode"
import deepEqual from "fast-deep-equal"
import { z } from "zod"

import { t } from "@i18n"

import {
	validateServerConfig,
	resolveConfigPath,
	updateServerConfig,
	readServerConfigFromFile,
	ServerConfigSchema,
} from "@services/mcp"
import { fetchToolsList } from "@services/mcp/features/tools"
import { fetchResourcesList, fetchResourceTemplatesList } from "@services/mcp/features/resources"

import type { McpHubState } from "@services/mcp/core/types"
import { findConnection, deleteConnection } from "@services/mcp/mcp-hub/connection/manager"
import { notifyWebviewOfServerChanges } from "@services/mcp/mcp-hub/notifications"
import { showErrorMessage, getProjectMcpPath, isMcpEnabled } from "@services/mcp/mcp-hub/init"
import { connectToServer, setupNewServer, reconnectServer } from "@services/mcp/mcp-hub/connection/lifecycle"
import { removeAllFileWatchers } from "@services/mcp/mcp-hub/watchers"
import { refreshServerCapabilities } from "./refresh"

// ─── Update server connections ───────────────────────────────────────

export async function updateServerConnections(
	state: McpHubState,
	newServers: Record<string, unknown>,
	source: "global" | "project" = "global",
	manageConnectingState: boolean = true,
	getMcpSettingsFilePath: () => Promise<string>,
): Promise<void> {
	if (manageConnectingState) {
		state.isConnecting = true
	}
	removeAllFileWatchers(state)
	const currentConnections = state.connections.filter(
		(conn) => conn.server.source === source || (!conn.server.source && source === "global"),
	)
	const currentNames = new Set(currentConnections.map((conn) => conn.server.name))
	const newNames = new Set(Object.keys(newServers))

	await removeDeletedServers(state, currentNames, newNames, source)
	await processNewServers(state, newServers, source, getMcpSettingsFilePath)

	await notifyWebviewOfServerChanges(state, getMcpSettingsFilePath, getProjectMcpPath)
	if (manageConnectingState) {
		state.isConnecting = false
	}
}

// ─── Remove deleted servers ──────────────────────────────────────────

async function removeDeletedServers(
	state: McpHubState,
	currentNames: Set<string>,
	newNames: Set<string>,
	source: "global" | "project",
): Promise<void> {
	for (const name of currentNames) {
		if (!newNames.has(name)) {
			await deleteConnection(state, name, source)
		}
	}
}

// ─── Process new servers ─────────────────────────────────────────────

async function processNewServers(
	state: McpHubState,
	newServers: Record<string, unknown>,
	source: "global" | "project",
	getMcpSettingsFilePath: () => Promise<string>,
): Promise<void> {
	for (const [name, config] of Object.entries(newServers)) {
		const currentConnection = findConnection(state, name, source)

		let validatedConfig: z.infer<typeof ServerConfigSchema>
		try {
			validatedConfig = validateServerConfig(config as Record<string, unknown>, name)
		} catch (error) {
			showErrorMessage(`Invalid configuration for MCP server "${name}"`, error)
			continue
		}

		if (!currentConnection) {
			await setupNewServer(state, name, validatedConfig, source)
		} else if (!deepEqual(JSON.parse(currentConnection.server.config), config)) {
			await reconnectServer(state, name, validatedConfig, source)
		}
	}
}

// ─── Toggle server disabled ──────────────────────────────────────────

export async function toggleServerDisabled(
	state: McpHubState,
	serverName: string,
	disabled: boolean,
	getMcpSettingsFilePath: () => Promise<string>,
	source?: "global" | "project",
): Promise<void> {
	try {
		const connection = findConnection(state, serverName, source)
		if (!connection) {
			throw new Error(`Server ${serverName}${source ? ` with source ${source}` : ""} not found`)
		}

		const serverSource = connection.server.source || "global"
		await updateServerConfig(
			serverName,
			{ disabled },
			serverSource,
			() => resolveConfigPath(serverSource, getMcpSettingsFilePath, getProjectMcpPath),
			() => {
				state.isProgrammaticUpdate = true
			},
			() => {
				setTimeout(() => {
					state.isProgrammaticUpdate = false
				}, 600)
			},
		)

		connection.server.disabled = disabled

		if (disabled && connection.server.status === "connected") {
			await deleteConnection(state, serverName, serverSource)
			const updatedConfig = await readServerConfigFromFile(
				serverName,
				serverSource,
				getMcpSettingsFilePath,
				getProjectMcpPath,
			)
			await connectToServer(state, serverName, updatedConfig, serverSource)
		} else if (!disabled && connection.server.status === "disconnected") {
			const updatedConfig = await readServerConfigFromFile(
				serverName,
				serverSource,
				getMcpSettingsFilePath,
				getProjectMcpPath,
			)
			await deleteConnection(state, serverName, serverSource)
			await connectToServer(state, serverName, updatedConfig, serverSource)
		} else if (connection.server.status === "connected") {
			await refreshServerCapabilities(state, serverName, serverSource, getMcpSettingsFilePath)
		}

		await notifyWebviewOfServerChanges(state, getMcpSettingsFilePath, getProjectMcpPath)
	} catch (error) {
		showErrorMessage(`Failed to update server ${serverName} state`, error)
		throw error
	}
}

// ─── Update server timeout ───────────────────────────────────────────

export async function updateServerTimeout(
	state: McpHubState,
	serverName: string,
	timeout: number,
	getMcpSettingsFilePath: () => Promise<string>,
	source?: "global" | "project",
): Promise<void> {
	try {
		const connection = findConnection(state, serverName, source)
		if (!connection) {
			throw new Error(`Server ${serverName}${source ? ` with source ${source}` : ""} not found`)
		}

		await updateServerConfig(
			serverName,
			{ timeout },
			connection.server.source || "global",
			() => resolveConfigPath(connection.server.source || "global", getMcpSettingsFilePath, getProjectMcpPath),
			() => {
				state.isProgrammaticUpdate = true
			},
			() => {
				setTimeout(() => {
					state.isProgrammaticUpdate = false
				}, 600)
			},
		)

		await notifyWebviewOfServerChanges(state, getMcpSettingsFilePath, getProjectMcpPath)
	} catch (error) {
		showErrorMessage(`Failed to update server ${serverName} timeout settings`, error)
		throw error
	}
}
