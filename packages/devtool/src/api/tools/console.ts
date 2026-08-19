import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtensionBridge } from "../bridge.js"

/**
 * Register console log tools on the MCP server.
 * Provides filtered access to console output from both
 * the extension host (backend) and webview (frontend) environments.
 */
export function registerConsoleTools(mcpServer: McpServer, bridge: ExtensionBridge) {
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
