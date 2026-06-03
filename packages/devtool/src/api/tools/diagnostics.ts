import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtensionBridge } from "../bridge.js"

/**
 * Register diagnostic tools on the MCP server.
 * These tools provide access to logs, snapshots, and diagnostics clearing.
 */
export function registerDiagnosticTools(mcpServer: McpServer, bridge: ExtensionBridge) {
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
