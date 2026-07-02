import * as vscode from "vscode"

import type { McpErrorEntry } from "@jabberwock/types"
import { sanitizeMcpName, toolNamesMatch } from "@utils/mcp"

import type { McpConnection } from "@services/mcp/core/types"
import type { McpHubState } from "@services/mcp/core/types"

// ─── Find connection ─────────────────────────────────────────────────

export function findConnection(
	state: McpHubState,
	serverName: string,
	source?: "global" | "project",
): McpConnection | undefined {
	if (source !== undefined) {
		return state.connections.find((conn) => conn.server.name === serverName && conn.server.source === source)
	}

	const projectConn = state.connections.find(
		(conn) => conn.server.name === serverName && conn.server.source === "project",
	)
	if (projectConn) return projectConn

	return state.connections.find(
		(conn) => conn.server.name === serverName && (conn.server.source === "global" || !conn.server.source),
	)
}

// ─── Find server name by sanitized name ──────────────────────────────

export function findServerNameBySanitizedName(state: McpHubState, sanitizedServerName: string): string | null {
	const exactMatch = state.connections.find((conn) => conn.server.name === sanitizedServerName)
	if (exactMatch) {
		return exactMatch.server.name
	}

	const registryMatch = state.sanitizedNameRegistry.get(sanitizedServerName)
	if (registryMatch) {
		return registryMatch
	}

	const fuzzyMatch = state.connections.find((conn) => toolNamesMatch(conn.server.name, sanitizedServerName))
	if (fuzzyMatch) {
		return fuzzyMatch.server.name
	}

	return null
}

// ─── Delete connection ───────────────────────────────────────────────

export async function deleteConnection(state: McpHubState, name: string, source?: "global" | "project"): Promise<void> {
	const connections = source
		? state.connections.filter((conn) => conn.server.name === name && conn.server.source === source)
		: state.connections.filter((conn) => conn.server.name === name)

	for (const connection of connections) {
		try {
			if (connection.type === "connected") {
				await connection.transport.close()
				await connection.client.close()
			}
		} catch (error) {
			console.error(`[jabberwock] Failed to close transport for ${name}:`, error)
		}
	}

	state.connections = state.connections.filter((conn) => {
		if (conn.server.name !== name) return true
		if (source && conn.server.source !== source) return true
		return false
	})

	const remainingConnections = state.connections.filter((conn) => conn.server.name === name)
	if (remainingConnections.length === 0) {
		const sanitizedName = sanitizeMcpName(name)
		state.sanitizedNameRegistry.delete(sanitizedName)
	}
}

// ─── Append error message ────────────────────────────────────────────

export function appendErrorMessage(
	connection: McpConnection,
	error: string,
	level: "error" | "warn" | "info" = "error",
): void {
	const MAX_ERROR_LENGTH = 1000
	const truncatedError =
		error.length > MAX_ERROR_LENGTH ? `${error.substring(0, MAX_ERROR_LENGTH)}...(error message truncated)` : error

	const currentHistory = connection.server.errorHistory ?? []
	const newEntry: McpErrorEntry = {
		message: truncatedError,
		timestamp: Date.now(),
		level,
	}

	const updatedHistory =
		currentHistory.length >= 100 ? [...currentHistory.slice(1), newEntry] : [...currentHistory, newEntry]

	connection.server.errorHistory = updatedHistory
	connection.server.error = truncatedError
}

// ─── Create placeholder connection ───────────────────────────────────

export function createPlaceholderConnection(
	name: string,
	config: string,
	source: "global" | "project",
	disabled: boolean,
): import("../../core/types").DisconnectedMcpConnection {
	return {
		type: "disconnected",
		server: {
			name,
			config,
			status: "disconnected",
			disabled,
			source,
			projectPath: source === "project" ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath : undefined,
			errorHistory: [],
		},
		client: null,
		transport: null,
	}
}

// ─── Get servers ─────────────────────────────────────────────────────

export function getServers(
	state: McpHubState,
	isServerVisibleToAgent: (name: string, config: Record<string, unknown>, mcpList?: string[]) => boolean,
	agentMcpList?: string[],
): import("@jabberwock/types").McpServer[] {
	const enabledConnections = state.connections.filter((conn) => !conn.server.disabled)

	const serversByName = new Map<string, import("@jabberwock/types").McpServer>()
	for (const conn of enabledConnections) {
		const existing = serversByName.get(conn.server.name)
		if (!existing) {
			serversByName.set(conn.server.name, conn.server)
		} else if (conn.server.source === "project" && existing.source !== "project") {
			serversByName.set(conn.server.name, conn.server)
		}
	}

	const allServers = Array.from(serversByName.values())

	if (!agentMcpList) {
		return allServers
	}

	return allServers.filter((server) => {
		let serverConfig: Record<string, unknown> = {}
		try {
			serverConfig = JSON.parse(server.config)
		} catch {}
		return isServerVisibleToAgent(server.name, serverConfig, agentMcpList)
	})
}

// ─── Get all servers ─────────────────────────────────────────────────

export function getAllServers(state: McpHubState): import("@jabberwock/types").McpServer[] {
	return state.connections.map((conn) => conn.server)
}
