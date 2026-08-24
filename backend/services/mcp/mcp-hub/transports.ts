import { z } from "zod"

import { getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js"

import type { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js"

import { ServerConfigSchema } from "@services/mcp/config/schemas"

import type { McpHubState } from "@services/mcp/core/types"
import { findConnection, appendErrorMessage } from "./connection/manager"
import { notifyWebviewOfServerChanges } from "./notifications"
import { getProjectMcpPath } from "./init"
import { getMcpSettingsFilePath as getMcpSettingsFilePathFromConfig } from "@services/mcp"

type ServerConfigInjected = z.infer<typeof ServerConfigSchema> & {
	command?: string
	url?: string
	headers?: Record<string, string>
	args?: string[]
	cwd?: string
	env?: Record<string, string>
	mcpTransport?: string
}

// ─── Create and configure transport ──────────────────────────────────

export function createAndConfigureTransport(
	configInjected: ServerConfigInjected,
	WebSocketClientTransport: new (url: string) => import("@modelcontextprotocol/sdk/shared/transport.js").Transport,
	StdioClientTransport: new (
		opts: StdioServerParameters,
	) => import("@modelcontextprotocol/sdk/shared/transport.js").Transport,
	SSEClientTransport: new (
		url: URL,
		opts?: Record<string, unknown>,
	) => import("@modelcontextprotocol/sdk/shared/transport.js").Transport,
	StreamableHTTPClientTransport: new (
		url: URL,
		opts?: Record<string, unknown>,
	) => import("@modelcontextprotocol/sdk/shared/transport.js").Transport,
	_ReconnectingEventSource: typeof import("reconnecting-eventsource").default,
): import("@modelcontextprotocol/sdk/shared/transport.js").Transport {
	if (configInjected.mcpTransport === "stdio") {
		return createStdioTransport(configInjected, StdioClientTransport)
	}
	if (configInjected.mcpTransport === "streamable-http") {
		return new StreamableHTTPClientTransport(new URL(configInjected.url!), {
			requestInit: {
				headers: configInjected.headers,
			},
		})
	}
	if (configInjected.mcpTransport === "sse") {
		return createSseTransport(configInjected, SSEClientTransport, _ReconnectingEventSource)
	}
	if (configInjected.mcpTransport === "websocket") {
		return new WebSocketClientTransport(configInjected.url!)
	}
	throw new Error("Unsupported MCP server transport type")
}

// ─── Create Stdio transport ──────────────────────────────────────────

export function createStdioTransport(
	configInjected: ServerConfigInjected,
	StdioClientTransport: new (
		opts: StdioServerParameters,
	) => import("@modelcontextprotocol/sdk/shared/transport.js").Transport,
): import("@modelcontextprotocol/sdk/shared/transport.js").Transport {
	if (configInjected.mcpTransport !== "stdio") {
		throw new Error("Expected stdio transport config")
	}

	const isWindows = process.platform === "win32"
	const cmd = configInjected.command!
	const isAlreadyWrapped = cmd.toLowerCase() === "cmd.exe" || cmd.toLowerCase() === "cmd"

	let command = cmd
	let args = configInjected.args ?? []
	if (isWindows && !isAlreadyWrapped) {
		command = "cmd.exe"
		args = ["/c", cmd, ...(configInjected.args ?? [])]
	}

	return new StdioClientTransport({
		command,
		args,
		cwd: configInjected.cwd,
		env: {
			...(getDefaultEnvironment?.() || {}),
			...(configInjected.env || {}),
		},
		stderr: "pipe",
	})
}

// ─── Create SSE transport ────────────────────────────────────────────

export function createSseTransport(
	configInjected: ServerConfigInjected,
	SSEClientTransport: new (
		url: URL,
		opts?: Record<string, unknown>,
	) => import("@modelcontextprotocol/sdk/shared/transport.js").Transport,
	_ReconnectingEventSource: typeof import("reconnecting-eventsource").default,
): import("@modelcontextprotocol/sdk/shared/transport.js").Transport {
	if (configInjected.mcpTransport !== "sse") {
		throw new Error("Expected SSE transport config")
	}

	const hasAuthHeader = Boolean(configInjected.headers?.["Authorization"])
	const reconnectingEventSourceOptions = {
		max_retry_time: 5000,
		withCredentials: hasAuthHeader,
		fetch: (url: string | URL, init: RequestInit) => {
			const headers = new Headers({ ...(init?.headers || {}), ...(configInjected.headers || {}) })
			return fetch(url, {
				...init,
				headers,
			})
		},
	}
	// eslint-disable-next-line no-restricted-syntax -- ReconnectingEventSource type differs from native EventSource but is runtime-compatible
	global.EventSource = _ReconnectingEventSource as unknown as typeof global.EventSource
	return new SSEClientTransport(new URL(configInjected.url!), {
		eventSourceInit: reconnectingEventSourceOptions,
	})
}

// ─── Create transport error handlers ─────────────────────────────────

export function createTransportErrorHandlers(
	state: McpHubState,
	name: string,
	source: "global" | "project",
): {
	onerror: (error: Error) => void
	onclose: () => void
} {
	const onerror = async (error: Error) => {
		console.error(`[jabberwock] Transport error for "${name}":`, error)
		const connection = findConnection(state, name, source)
		if (connection) {
			connection.server.status = "disconnected"
			appendErrorMessage(connection, error instanceof Error ? error.message : `${error}`)
		}
		const getMcpSettingsFilePath = async (): Promise<string> => {
			return getMcpSettingsFilePathFromConfig(state._context)
		}
		await notifyWebviewOfServerChanges(state, getMcpSettingsFilePath, getProjectMcpPath)
	}

	const onclose = async () => {
		const connection = findConnection(state, name, source)
		if (connection) {
			connection.server.status = "disconnected"
		}
		const getMcpSettingsFilePath = async (): Promise<string> => {
			return getMcpSettingsFilePathFromConfig(state._context)
		}
		await notifyWebviewOfServerChanges(state, getMcpSettingsFilePath, getProjectMcpPath)
	}

	return { onerror, onclose }
}
