import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

import type { McpErrorEntry, McpResource, McpResourceTemplate, McpServer, McpTool } from "@jabberwock/types"

import { WebSocketClientTransport } from "@services/mcp/features/websocket-transport"

// ─── Connection types ────────────────────────────────────────────────

export type ConnectedMcpConnection = {
	type: "connected"
	server: McpServer
	client: Client
	transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport | WebSocketClientTransport
}

export type DisconnectedMcpConnection = {
	type: "disconnected"
	server: McpServer
	client: null
	transport: null
}

export type McpConnection = ConnectedMcpConnection | DisconnectedMcpConnection

// ─── Store types ─────────────────────────────────────────────────────

export interface ServerConfigStore {
	setCustomModes?(modes: unknown[]): void
	setCachedAt?(t: number): void
	setFilePath?(p: string): void
}

// ─── Tool result types ───────────────────────────────────────────────

export interface McpToolCallOptions {
	serverName: string
	toolName: string
	toolArguments?: Record<string, unknown>
	source?: "global" | "project"
	activeTaskId?: string
	agentRole?: string
	workspacePath?: string
}

// ─── Connection helper types ─────────────────────────────────────────

export interface ConnectionLookup {
	findConnection: (serverName: string, source?: "global" | "project") => McpConnection | undefined
	findServerNameBySanitizedName: (sanitizedServerName: string) => string | null
}

// ─── McpHub state needed by helpers ──────────────────────────────────

export interface McpHubState {
	connections: McpConnection[]
	fileWatchers: Map<string, import("chokidar").FSWatcher[]>
	configChangeDebounceTimers: Map<string, NodeJS.Timeout>
	isProgrammaticUpdate: boolean
	flagResetTimer?: NodeJS.Timeout
	sanitizedNameRegistry: Map<string, string>
	isConnecting: boolean
	isDisposed: boolean
	providerRef: WeakRef<import("@features/foundation/webview/EventBridge").ProviderHandle>
	_context: import("vscode").ExtensionContext
	refCount: number
	settingsWatcher?: import("vscode").FileSystemWatcher
	projectMcpWatcher?: import("vscode").FileSystemWatcher
	disposables: import("vscode").Disposable[]
}

export { McpErrorEntry, McpResource, McpResourceTemplate, McpServer, McpTool }
