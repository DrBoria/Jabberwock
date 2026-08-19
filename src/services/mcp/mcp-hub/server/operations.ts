import { safeWriteJson } from "@utils/io"

import {
	resolveConfigPath,
	readServerConfigFromFile,
	getMcpSettingsFilePath as getMcpSettingsFilePathFromConfig,
} from "@services/mcp"
import { parseToolTimeout, formatToolResponse } from "@services/mcp/features/tools"
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"
import { readFile } from "fs/promises"

import type { McpToolCallResponse, McpResourceResponse } from "@jabberwock/types"
import type { McpHubState } from "@services/mcp/core/types"

import { findConnection, deleteConnection } from "@services/mcp/mcp-hub/connection/manager"
import {
	notifyWebviewOfServerChanges,
	readProviderContext,
	getWorkspacePathValue,
} from "@services/mcp/mcp-hub/notifications"
import { showErrorMessage, getProjectMcpPath } from "@services/mcp/mcp-hub/init"
import { connectToServer } from "@services/mcp/mcp-hub/connection/lifecycle"
import {
	readResource as readResourceFromUtils,
	requireConnectedConnection,
} from "@services/mcp/mcp-hub/connection/server-connection-utils"

// ─── Call tool ───────────────────────────────────────────────────────

export async function callTool(
	state: McpHubState,
	serverName: string,
	toolName: string,
	toolArguments?: Record<string, unknown>,
	source?: "global" | "project",
): Promise<McpToolCallResponse> {
	const connection = requireConnectedConnection(state, serverName, source)

	if (connection.server.disabled) {
		throw new Error(`Server "${serverName}" is disabled and cannot be used`)
	}

	const timeout = parseToolTimeout(connection.server.config)

	const targetProvider = state.providerRef?.deref()
	let activeTaskId = ""
	let agentRole = ""
	if (targetProvider) {
		const context = readProviderContext(targetProvider)
		activeTaskId = context.activeTaskId
		agentRole = context.agentRole
	}

	const workspacePath = getWorkspacePathValue()

	const response = await connection.client.request(
		{
			method: "tools/call",
			params: {
				name: toolName,
				arguments: toolArguments,
				_meta: {
					activeTaskId,
					agentRole,
					workspacePath,
				},
			},
		},
		CallToolResultSchema,
		{
			timeout,
		},
	)

	return formatToolResponse(response)
}

// ─── Read resource ───────────────────────────────────────────────────

export async function readResource(
	state: McpHubState,
	serverName: string,
	uri: string,
	source?: "global" | "project",
): Promise<McpResourceResponse> {
	const response = await readResourceFromUtils(state, serverName, uri, source)
	return response
}

// ─── Restart connection ──────────────────────────────────────────────

export async function restartConnection(
	state: McpHubState,
	serverName: string,
	source?: "global" | "project",
): Promise<void> {
	try {
		const connection = findConnection(state, serverName, source)
		if (!connection) {
			throw new Error(`Server "${serverName}" not found`)
		}

		const serverSource = connection.server.source || "global"
		await deleteConnection(state, serverName, serverSource)

		const updatedConfig = await readServerConfigFromFile(
			serverName,
			serverSource,
			async () => {
				return getMcpSettingsFilePathFromConfig(state._context)
			},
			getProjectMcpPath,
		)

		await connectToServer(state, serverName, updatedConfig, serverSource)
		await notifyWebviewOfServerChanges(
			state,
			async () => {
				return getMcpSettingsFilePathFromConfig(state._context)
			},
			getProjectMcpPath,
		)
	} catch (error) {
		showErrorMessage(`Failed to restart connection for "${serverName}"`, error)
		throw error
	}
}

// ─── Delete server ───────────────────────────────────────────────────

export async function deleteServer(
	state: McpHubState,
	serverName: string,
	getMcpSettingsFilePath: () => Promise<string>,
	source?: "global" | "project",
): Promise<void> {
	try {
		const connection = findConnection(state, serverName, source)
		if (!connection) {
			throw new Error(`Server "${serverName}" not found`)
		}

		const serverSource = connection.server.source || "global"
		await deleteConnection(state, serverName, serverSource)

		const configPath = await resolveConfigPath(serverSource, getMcpSettingsFilePath, getProjectMcpPath)
		const content = await readFile(configPath, "utf-8")
		const config = JSON.parse(content)

		if (config.mcpServers?.[serverName]) {
			const { mcpServers, ...rest } = config
			const { [serverName]: _removed, ...remainingServers } = mcpServers
			const updatedConfig = { ...rest, mcpServers: remainingServers }

			await safeWriteJson(configPath, updatedConfig, { prettyPrint: true })
		}

		await notifyWebviewOfServerChanges(state, getMcpSettingsFilePath, getProjectMcpPath)
	} catch (error) {
		showErrorMessage(`Failed to delete server "${serverName}"`, error)
		throw error
	}
}
