import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { DevtoolMethods } from "../mcp/server.js"

/**
 * Backend console domain. Registers the `get_console` / `search_console` and
 * the diagnostics MCP tools on the server. The console handlers themselves
 * live in `./console-handlers.js` (backend path reads the profiler, frontend
 * path delegates to the frontend bridge).
 */

/**
 * Register diagnostic tools on the MCP server.
 * These tools provide access to logs, snapshots, and diagnostics clearing —
 * all read from the profiler (in-memory diagnostics).
 */
export function registerDiagnosticTools(mcpServer: McpServer, bridge: DevtoolMethods) {
	mcpServer.tool(
		"get_logs",
		{
			lines: z
				.number()
				.min(1)
				.max(10)
				.optional()
				.default(10)
				.describe("Number of recent lines to read. Default: 10, max: 10."),
		},
		async ({ lines = 100 }) => {
			try {
				const result = await bridge.getLogs(lines)
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

	mcpServer.tool(
		"get_diagnostics_snapshot",
		{
			limit: z
				.number()
				.min(1)
				.max(10)
				.optional()
				.default(10)
				.describe("Max log entries to return (last N). Default: 10, max: 10."),
			offset: z.number().optional().describe("Skip N entries from start (for pagination). Default: 0."),
			level: z.enum(["info", "warn", "error", "debug"]).optional().describe("Filter by log level."),
			search: z.string().optional().describe("Filter logs containing this substring (case-insensitive)."),
			includeLogs: z.boolean().optional().describe("Include log entries. Default: true (limited to 10)."),
			includeMetrics: z.boolean().optional().describe("Include performance metrics. Default: false."),
			includePatches: z.boolean().optional().describe("Include MST patches. Default: false."),
			includeTraces: z.boolean().optional().describe("Include task/tool traces. Default: false."),
			includeResources: z.boolean().optional().describe("Include resource snapshots. Default: false."),
		},
		async (params) => {
			try {
				const snapshot = await bridge.getDiagnosticsSnapshot(params)
				return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] }
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

	mcpServer.tool("clear_diagnostics", {}, async () => {
		try {
			await bridge.clearDiagnostics()
			return { content: [{ type: "text", text: "Diagnostics cleared." }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
}

/**
 * Register console log tools on the MCP server.
 * Provides filtered access to console output from both
 * the extension host (backend) and webview (frontend) environments.
 */
export function registerConsoleTools(mcpServer: McpServer, bridge: DevtoolMethods) {
	mcpServer.tool(
		"get_console",
		"Get console logs from backend (extension host) or frontend (webview), with level filtering, text search, and cursor-based pagination",
		{
			env: z
				.enum(["backend", "frontend"])
				.describe("Environment to retrieve logs from: 'backend' (extension host) or 'frontend' (webview)"),
			level: z
				.enum(["error", "warn", "info", "debug"])
				.optional()
				.describe("Filter by log level. If omitted, returns all levels."),
			search: z
				.string()
				.optional()
				.describe("Optional text to search for within log messages (case-insensitive substring match)."),
			limit: z
				.number()
				.min(1)
				.max(10)
				.optional()
				.default(10)
				.describe("Maximum number of log entries to return (default: 10, max: 10)."),
			cursor: z
				.number()
				.optional()
				.default(0)
				.describe("Number of entries to skip from the end (for pagination, default: 0)."),
		},
		async ({ env, level, search, limit = 10, cursor = 0 }) => {
			try {
				const result = await bridge.getConsole({ env, level, search, limit, cursor })
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

	mcpServer.tool(
		"search_console",
		"Search console logs by text content across environments, with level filtering and cursor-based pagination",
		{
			query: z.string().describe("Text to search for (case-insensitive substring match)"),
			env: z
				.enum(["backend", "frontend"])
				.optional()
				.describe("Optional environment filter. If omitted, searches both backend and frontend."),
			level: z
				.enum(["error", "warn", "info", "debug"])
				.optional()
				.describe("Filter by log level. If omitted, returns all levels."),
			limit: z
				.number()
				.min(1)
				.max(10)
				.optional()
				.default(10)
				.describe("Maximum number of log entries to return (default: 10, max: 10)."),
			cursor: z
				.number()
				.optional()
				.default(0)
				.describe("Number of entries to skip from the end (for pagination, default: 0)."),
		},
		async ({ query, env, level, limit = 10, cursor = 0 }) => {
			try {
				const result = await bridge.searchConsole({ env, query, level, limit, cursor })
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
}
