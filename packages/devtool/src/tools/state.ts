import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtensionBridge } from "../bridge.js"

/**
 * Register state inspection tools on the MCP server.
 * These tools provide access to MST stores, extension info, and current state.
 */
export function registerStateTools(mcpServer: McpServer, bridge: ExtensionBridge) {
	mcpServer.tool(
		"get_mst_state",
		{
			store: z.string().optional().describe("Which MST store to query."),
			mode: z.enum(["graph", "query"]).optional().describe("'graph' or 'query' mode."),
			depth: z.number().min(1).max(5).optional().describe("Depth for graph/query mode."),
			path: z.string().optional().describe("Dot-separated path for query mode."),
			nodeId: z.string().optional().describe("TaskNode ID shortcut for query mode."),
			fields: z.string().optional().describe("Comma-separated field filter for query mode."),
		},
		async (params) => {
			try {
				const result = await bridge.getMstState(params)
				return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
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

	mcpServer.tool("get_extension_info", {}, async () => {
		try {
			const result = await bridge.getExtensionInfo()
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_current_state", {}, async () => {
		try {
			const result = await bridge.getCurrentState()
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
}
