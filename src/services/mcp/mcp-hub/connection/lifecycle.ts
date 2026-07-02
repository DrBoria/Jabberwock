import * as vscode from "vscode"

import { z } from "zod"
import type { InjectableConfigType } from "@utils/config"

import { injectVariables } from "@utils/config"

import { ServerConfigSchema } from "@services/mcp/config/schemas"
import { fetchToolsList } from "@services/mcp/features/tools"
import { fetchResourcesList, fetchResourceTemplatesList } from "@services/mcp/features/resources"

import type { McpHubState } from "@services/mcp/core/types"
import { findConnection, deleteConnection, createPlaceholderConnection } from "./manager"
import { notifyWebviewOfServerChanges } from "@services/mcp/mcp-hub/notifications"
import { isMcpEnabled, getProjectMcpPath, showErrorMessage } from "@services/mcp/mcp-hub/init"
import { createAndConfigureTransport, createTransportErrorHandlers } from "@services/mcp/mcp-hub/transports"
import { setupStdioStderr, setupElicitationHandler } from "@services/mcp/mcp-hub/transport-handlers"
import { sanitizeMcpName } from "@utils/mcp"
import { getMcpSettingsFilePath as getMcpSettingsFilePathFromConfig } from "@services/mcp"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import ReconnectingEventSource from "reconnecting-eventsource"
import { WebSocketClientTransport } from "@services/mcp/features/websocket-transport"

// ─── Setup new server / reconnect server ─────────────────────────────

export async function setupNewServer(
	state: McpHubState,
	name: string,
	validatedConfig: z.infer<typeof ServerConfigSchema>,
	source: "global" | "project",
): Promise<void> {
	try {
		if (!validatedConfig.disabled) {
			// File watcher setup will be handled by connectToServer
		}
		await connectToServer(state, name, validatedConfig, source)
	} catch (error) {
		showErrorMessage(`Failed to connect to new MCP server ${name}`, error)
	}
}

export async function reconnectServer(
	state: McpHubState,
	name: string,
	validatedConfig: z.infer<typeof ServerConfigSchema>,
	source: "global" | "project",
): Promise<void> {
	try {
		await deleteConnection(state, name, source)
		await connectToServer(state, name, validatedConfig, source)
	} catch (error) {
		showErrorMessage(`Failed to reconnect MCP server ${name}`, error)
	}
}

// ─── Connect to server ───────────────────────────────────────────────

export async function connectToServer(
	state: McpHubState,
	name: string,
	config: z.infer<typeof ServerConfigSchema>,
	source: "global" | "project" = "global",
): Promise<void> {
	await deleteConnection(state, name, source)

	const sanitizedName = sanitizeMcpName(name)
	state.sanitizedNameRegistry.set(sanitizedName, name)

	const mcpEnabled = await isMcpEnabled()
	if (!mcpEnabled) {
		state.connections.push(createPlaceholderConnection(name, JSON.stringify(config), source, true))
		return
	}

	if (config.disabled) {
		state.connections.push(createPlaceholderConnection(name, JSON.stringify(config), source, true))
		return
	}

	await connectToServerInner(state, name, config, source)
}

// ─── Connect to server inner ─────────────────────────────────────────

async function connectToServerInner(
	state: McpHubState,
	name: string,
	config: z.infer<typeof ServerConfigSchema>,
	source: "global" | "project",
): Promise<void> {
	const client = new Client(
		{
			name: "Jabberwock",
			version: state._context.extension?.packageJSON?.version ?? "1.0.0",
		},
		{
			capabilities: {
				prompts: {},
				resources: {},
				tools: {},
				elicitation: {},
			},
		},
	)

	setupElicitationHandler(client, state)

	const configInjected = (await injectVariables(config as InjectableConfigType, {
		env: process.env,
		workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
	})) as typeof config

	const { onerror, onclose } = createTransportErrorHandlers(state, name, source)

	const transport = createAndConfigureTransport(
		configInjected,
		WebSocketClientTransport,
		StdioClientTransport,
		SSEClientTransport,
		StreamableHTTPClientTransport,
		ReconnectingEventSource,
	)
	transport.onerror = onerror
	transport.onclose = onclose

	if (configInjected.mcpTransport === "stdio") {
		await transport.start()
		setupStdioStderr(state, transport as InstanceType<typeof StdioClientTransport>, name, source)
		transport.start = async () => {}
	}

	const connection = buildServerConnection(name, configInjected, source, client, transport)
	state.connections.push(connection)

	await client.connect(transport)
	connection.server.status = "connected"
	connection.server.error = ""
	connection.server.instructions = client.getInstructions()

	const getMcpSettingsFilePath = async (): Promise<string> => {
		return getMcpSettingsFilePathFromConfig(state._context)
	}

	connection.server.tools = await fetchToolsList(
		name,
		source,
		(n, s) => findConnection(state, n, s),
		getMcpSettingsFilePath,
		getProjectMcpPath,
	)
	connection.server.resources = await fetchResourcesList(name, source, (n, s) => findConnection(state, n, s))
	connection.server.resourceTemplates = await fetchResourceTemplatesList(name, source, (n, s) =>
		findConnection(state, n, s),
	)
}

// ─── Build server connection ─────────────────────────────────────────

function buildServerConnection(
	name: string,
	configInjected: z.infer<typeof ServerConfigSchema>,
	source: "global" | "project",
	client: import("@modelcontextprotocol/sdk/client/index.js").Client,
	transport: import("@modelcontextprotocol/sdk/shared/transport.js").Transport,
): import("../../core/types").ConnectedMcpConnection {
	return {
		type: "connected",
		server: {
			name,
			config: JSON.stringify(configInjected),
			status: "connecting",
			disabled: configInjected.disabled,
			source,
			projectPath: source === "project" ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath : undefined,
			errorHistory: [],
		},
		client,
		transport: transport as never,
	}
}
