import { CallToolResultSchema, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js"

import type { McpTool, McpToolCallResponse } from "@jabberwock/types"

import { z } from "zod"

import { readServerToolConfig, readServerConfigFromFile, ServerConfigSchema } from "@services/mcp/index"
import type { McpConnection } from "@services/mcp/core/types"

// ─── Tool timeout ────────────────────────────────────────────────────

export function parseToolTimeout(serverConfig: string): number {
	try {
		const parsedConfig = ServerConfigSchema.parse(JSON.parse(serverConfig))
		return (parsedConfig.timeout ?? 60) * 1000
	} catch {
		return 60 * 1000
	}
}

// ─── Tool response formatting ────────────────────────────────────────

export function formatToolResponse(response: z.infer<typeof CallToolResultSchema>): McpToolCallResponse {
	const result: McpToolCallResponse = {
		...response,
		content: (response.content || []).map((c) => ({
			...c,
			type: normalizeContentType(c.type),
		})) as McpToolCallResponse["content"],
	}
	return result
}

function normalizeContentType(rawType: string | undefined): "text" | "image" | "audio" | "resource" {
	switch (rawType) {
		case "text":
			return "text"
		case "image":
			return "image"
		case "audio":
			return "audio"
		case "resource":
			return "resource"
		default:
			return "text"
	}
}

// ─── Fetch tools list ────────────────────────────────────────────────

export async function fetchToolsList(
	serverName: string,
	source: "global" | "project" | undefined,
	findConnection: (name: string, s?: "global" | "project") => McpConnection | undefined,
	getMcpSettingsFilePath: () => Promise<string>,
	getProjectMcpPath: () => Promise<string | null>,
): Promise<McpTool[]> {
	try {
		const connection = findConnection(serverName, source)

		if (!connection || connection.type !== "connected") {
			return []
		}

		const response = await connection.client.request({ method: "tools/list" }, ListToolsResultSchema)

		const actualSource = connection.server.source || "global"
		const { alwaysAllowConfig, disabledToolsList } = await readServerToolConfig(
			serverName,
			actualSource,
			getMcpSettingsFilePath,
			getProjectMcpPath,
		)

		const hasWildcard = alwaysAllowConfig.includes("*")

		const tools = (response?.tools || []).map((tool) => ({
			name: tool.name ?? "",
			description: tool.description ?? "",
			inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
			alwaysAllow: hasWildcard || alwaysAllowConfig.includes(tool.name ?? ""),
			enabledForPrompt: !disabledToolsList.includes(tool.name ?? ""),
		})) as McpTool[]

		return tools
	} catch (error) {
		console.error(`[jabberwock] Failed to fetch tools for ${serverName}:`, error)
		return []
	}
}

// ─── Call tool ───────────────────────────────────────────────────────

export async function callTool(
	serverName: string,
	toolName: string,
	toolArguments: Record<string, unknown> | undefined,
	source: "global" | "project" | undefined,
	findConnection: (name: string, s?: "global" | "project") => McpConnection | undefined,
	readProviderContext: () => { activeTaskId: string; agentRole: string },
	getWorkspacePathValue: () => string,
): Promise<McpToolCallResponse> {
	const connection = requireConnectedConnection(serverName, source, findConnection)

	if (connection.server.disabled) {
		throw new Error(`Server "${serverName}" is disabled and cannot be used`)
	}

	const timeout = parseToolTimeout(connection.server.config)

	const { activeTaskId, agentRole } = readProviderContext()
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

function requireConnectedConnection(
	serverName: string,
	source: "global" | "project" | undefined,
	findConnection: (name: string, s?: "global" | "project") => McpConnection | undefined,
): McpConnection & { type: "connected" } {
	const connection = findConnection(serverName, source)
	if (!connection || connection.type !== "connected") {
		throw new Error(
			`No connection found for server: ${serverName}${source ? ` with source ${source}` : ""}. Please make sure to use MCP servers available under 'Connected MCP Servers'.`,
		)
	}
	return connection
}
