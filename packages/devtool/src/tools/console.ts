import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtensionBridge } from "../bridge.js"

/**
 * Register console log tools on the MCP server.
 * Provides filtered access to the extension's console output
 * (devtools console, not the logs tab).
 */
export function registerConsoleTools(mcpServer: McpServer, bridge: ExtensionBridge) {
	mcpServer.tool(
		"get_console_logs",
		{
			level: z
				.enum(["error", "warn", "info", "debug"])
				.optional()
				.describe("Filter by log level. If omitted, returns all levels."),
			limit: z.number().optional().default(3).describe("Maximum number of log entries to return (default: 3)."),
			offset: z
				.number()
				.optional()
				.default(0)
				.describe("Number of entries to skip from the end (for pagination, default: 0)."),
		},
		async ({ level, limit = 3, offset = 0 }) => {
			try {
				const result = await bridge.getConsoleLogs(level, limit, offset)
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
