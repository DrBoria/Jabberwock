#!/usr/bin/env node

/**
 * Standalone stdio MCP entry point for Jabberwock DevTools.
 *
 * Architecture:
 *   Roo → stdio McpServer → WebSocket MCP Client → Extension WsMcpServer → bridge → real implementation
 *
 * The stdio process runs as a standalone Node.js process (via `tsx`), registered in .roo/mcp.json
 * with `"type": "stdio"`. It connects to the extension's WebSocket MCP server as a client,
 * proxying all tool calls. On extension reload, it polls the HTTP status endpoint to detect
 * when the extension is back, then auto-reconnects the WebSocket.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { DevtoolClient } from "../client.js"
import { getBuildTimestamp } from "./http-server.js"

const WS_PORT = 60060
const HTTP_STATUS_PORT = 60061
const RECONNECT_INTERVAL_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 30

let client: DevtoolClient
let connected = false

async function waitForExtension(maxAttempts: number = MAX_RECONNECT_ATTEMPTS): Promise<boolean> {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const response = await fetch(`http://127.0.0.1:${HTTP_STATUS_PORT}/status`)
			if (response.ok) {
				const data = await response.json()
				console.error(
					`[devtools] Extension available (build: ${data.buildTimestamp}, uptime: ${Math.floor(data.uptime)}s)`,
				)
				return true
			}
		} catch {
			// Extension not ready yet
		}
		if (attempt < maxAttempts) {
			await new Promise((r) => setTimeout(r, RECONNECT_INTERVAL_MS))
		}
	}
	return false
}

async function ensureConnection(): Promise<void> {
	if (connected && client) return

	// Wait for the extension process to be available
	const available = await waitForExtension()
	if (!available) {
		throw new Error("Extension not available after maximum wait time")
	}

	// Connect as an MCP client to the extension's WebSocket MCP server
	if (!client) {
		client = new DevtoolClient({ port: WS_PORT })
	}

	try {
		await client.connect()
		connected = true
		console.error("[devtools] Connected to extension WebSocket MCP server")
	} catch (err) {
		connected = false
		console.error("[devtools] Failed to connect:", err)
		throw err
	}
}

async function proxyToolCall(name: string, args: Record<string, unknown> = {}): Promise<string> {
	await ensureConnection()
	try {
		const result = await client.callTool(name, args)
		// callTool already parses JSON, so if it's an object, stringify back
		if (typeof result === "string") {
			return result
		}
		return JSON.stringify(result)
	} catch (error) {
		console.error(`[devtools] Tool call failed: ${name}`, error)
		// If connection lost, mark for reconnect and retry once
		connected = false
		await ensureConnection()
		const result = await client.callTool(name, args)
		if (typeof result === "string") {
			return result
		}
		return JSON.stringify(result)
	}
}

async function main() {
	const banner = `
╔══════════════════════════════════════╗
║  Jabberwock DevTools (Stdio)         ║
║  Build: ${getBuildTimestamp()}         ║
╚══════════════════════════════════════╝`
	console.error(banner)

	const server = new McpServer({
		name: "jabberwock-devtools",
		version: "1.0.0",
	})

	// ── Register all tools (proxy to extension via WebSocket MCP client) ──

	server.tool("get_extension_info", "Get extension metadata: name, version, available stores", {}, async () => {
		try {
			const result = await proxyToolCall("get_extension_info")
			return { content: [{ type: "text", text: result }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	server.tool(
		"get_current_state",
		"Get current extension state summary (chat, settings, foundation store keys)",
		{},
		async () => {
			try {
				const result = await proxyToolCall("get_current_state")
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool("get_active_page", "Get the currently active page in the extension's webview", {}, async () => {
		try {
			const result = await proxyToolCall("get_active_page")
			return { content: [{ type: "text", text: result }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	server.tool(
		"get_store_state",
		"Inspect extension state stores (backend or frontend/webview)",
		{
			env: {
				type: "string" as const,
				description: "'backend' (VS Code extension host) or 'frontend' (webview React app)",
			},
			store: {
				type: "string" as const,
				description: "Store name or dot-separated path (e.g. 'chat', 'chat.isRunning')",
				optional: true,
			},
			limit: {
				type: "number" as const,
				description: "Items per page (max 10)",
				defaultValue: 10,
			},
			cursor: {
				type: "number" as const,
				description: "Pagination cursor (0-based)",
				defaultValue: 0,
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("get_store_state", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"get_store_actions",
		"List available store actions (backend or frontend)",
		{
			env: {
				type: "string" as const,
				description: "'backend' or 'frontend'",
			},
			limit: {
				type: "number" as const,
				description: "Items per page (max 10)",
				defaultValue: 10,
			},
			cursor: {
				type: "number" as const,
				description: "Pagination cursor",
				defaultValue: 0,
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("get_store_actions", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"filter_actions",
		"Filter store actions by pattern",
		{
			env: {
				type: "string" as const,
				description: "'backend' or 'frontend'",
			},
			pattern: {
				type: "string" as const,
				description: "Action name pattern to filter by (e.g. 'set', 'toggle')",
			},
			limit: {
				type: "number" as const,
				description: "Items per page (max 10)",
				defaultValue: 10,
			},
			cursor: {
				type: "number" as const,
				description: "Pagination cursor",
				defaultValue: 0,
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("filter_actions", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"search_actions",
		"Search store actions by query",
		{
			env: {
				type: "string" as const,
				description: "'backend' or 'frontend'",
			},
			query: {
				type: "string" as const,
				description: "Search query for action names",
			},
			limit: {
				type: "number" as const,
				description: "Items per page (max 10)",
				defaultValue: 10,
			},
			cursor: {
				type: "number" as const,
				description: "Pagination cursor",
				defaultValue: 0,
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("search_actions", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"count_actions",
		"Count store actions",
		{
			env: {
				type: "string" as const,
				description: "'backend' or 'frontend'",
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("count_actions", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"get_store_actions_log",
		"Get store actions log (timestamped action history)",
		{
			env: {
				type: "string" as const,
				description: "'backend' or 'frontend'",
			},
			limit: {
				type: "number" as const,
				description: "Items per page",
				defaultValue: 10,
			},
			cursor: {
				type: "number" as const,
				description: "Pagination cursor",
				defaultValue: 0,
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("get_store_actions_log", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"search_state",
		"Search extension state by content/ID/text",
		{
			env: {
				type: "string" as const,
				description: "'backend' or 'frontend'",
			},
			query: {
				type: "string" as const,
				description: "Search query",
			},
			limit: {
				type: "number" as const,
				description: "Maximum results (max 20)",
				defaultValue: 10,
			},
			cursor: {
				type: "number" as const,
				description: "Pagination cursor",
				defaultValue: 0,
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("search_state", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"run_command",
		"Execute arbitrary JavaScript in the extension's webview context",
		{
			command: {
				type: "string" as const,
				description: "JavaScript to execute",
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("run_command", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"find_element",
		"Find DOM element by CSS selector or text, optionally with depth/maxChildren/command",
		{
			selector: {
				type: "string" as const,
				description: "CSS selector, text content, or '*' for full DOM tree",
			},
			depth: {
				type: "number" as const,
				description: "DOM serialization depth",
				optional: true,
			},
			maxChildren: {
				type: "number" as const,
				description: "Max children per node",
				optional: true,
			},
			command: {
				type: "string" as const,
				description: "JS to run on matched element (use $0 as reference)",
				optional: true,
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("find_element", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"click_element",
		"Click a DOM element by id or CSS selector",
		{
			id: { type: "string" as const, description: "Element ID", optional: true },
			selector: { type: "string" as const, description: "CSS selector", optional: true },
		},
		async (params) => {
			try {
				const result = await proxyToolCall("click_element", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"type_text",
		"Type text into an input element",
		{
			id: { type: "string" as const, description: "Element ID", optional: true },
			selector: { type: "string" as const, description: "CSS selector", optional: true },
			text: { type: "string" as const, description: "Text to type" },
			submit: { type: "boolean" as const, description: "Press Enter after typing", optional: true },
		},
		async (params) => {
			try {
				const result = await proxyToolCall("type_text", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"scroll_element",
		"Scroll a DOM element in a direction",
		{
			id: { type: "string" as const, description: "Element ID", optional: true },
			direction: { type: "string" as const, description: "up/down/left/right" },
			selector: { type: "string" as const, description: "CSS selector", optional: true },
		},
		async (params) => {
			try {
				const result = await proxyToolCall("scroll_element", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"select_option",
		"Select an option in a select element",
		{
			id: { type: "string" as const, description: "Select element ID" },
			value: { type: "string" as const, description: "Option value to select" },
		},
		async (params) => {
			try {
				const result = await proxyToolCall("select_option", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool("get_screenshot", "Take a screenshot of the extension's webview", {}, async () => {
		try {
			const result = await proxyToolCall("get_screenshot")
			return { content: [{ type: "text", text: result }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	server.tool(
		"get_console",
		"Get console logs from backend (extension host) or frontend (webview). Supports filtering by environment and log level with cursor-based pagination.",
		{
			env: {
				type: "string" as const,
				description: "Environment: backend (extension host) or frontend (webview)",
			},
			level: {
				type: "string" as const,
				description: "Filter by log level: error/warn/info/debug",
				optional: true,
			},
			limit: { type: "number" as const, description: "Max entries (default: 10)", defaultValue: 10 },
			cursor: { type: "number" as const, description: "Entries to skip from end (default: 0)", defaultValue: 0 },
		},
		async (params) => {
			try {
				const result = await proxyToolCall("get_console", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"search_console",
		"Search console logs by text content across backend (extension host) or frontend (webview). Supports filtering by environment and log level.",
		{
			query: { type: "string" as const, description: "Text to search for (case-insensitive)" },
			env: {
				type: "string" as const,
				description: "Environment: backend (extension host) or frontend (webview). If omitted, searches both.",
				optional: true,
			},
			level: {
				type: "string" as const,
				description: "Filter by log level: error/warn/info/debug",
				optional: true,
			},
			limit: { type: "number" as const, description: "Max entries per env (default: 10)", defaultValue: 10 },
			cursor: {
				type: "number" as const,
				description: "Entries to skip from end per env (default: 0)",
				defaultValue: 0,
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("search_console", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"get_logs",
		"Get diagnostic logs from the extension",
		{
			lines: { type: "number" as const, description: "Number of recent lines (default: 100)", defaultValue: 100 },
		},
		async (params) => {
			try {
				const result = await proxyToolCall("get_logs", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool(
		"get_diagnostics_snapshot",
		"Get a diagnostics snapshot with optional filtering",
		{
			limit: { type: "number" as const, description: "Max log entries", optional: true },
			offset: { type: "number" as const, description: "Skip N entries", optional: true },
			level: { type: "string" as const, description: "Filter by level", optional: true },
			search: { type: "string" as const, description: "Filter by substring", optional: true },
		},
		async (params) => {
			try {
				const result = await proxyToolCall("get_diagnostics_snapshot", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	server.tool("clear_diagnostics", "Clear all diagnostic logs", {}, async () => {
		try {
			const result = await proxyToolCall("clear_diagnostics")
			return { content: [{ type: "text", text: result }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	server.tool(
		"execute_vscode_command",
		"Execute a VS Code command in the extension host",
		{
			command: {
				type: "string" as const,
				description: "VS Code command ID to execute",
			},
			args: {
				type: "unknown" as const,
				description: "Optional arguments",
				optional: true,
			},
		},
		async (params) => {
			try {
				const result = await proxyToolCall("execute_vscode_command", params as Record<string, unknown>)
				return { content: [{ type: "text", text: result }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	// ── Start the stdio transport ──

	const transport = new StdioServerTransport()
	console.error("[devtools] Starting stdio MCP server...")
	await server.connect(transport)
	console.error("[devtools] Stdio MCP server ready")
}

main().catch((err) => {
	console.error("[devtools] Fatal error:", err)
	process.exit(1)
})
