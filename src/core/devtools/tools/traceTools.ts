import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../webview/ClineProvider"
import { diagnosticsManager } from "../DiagnosticsManager"

export function registerTraceTools(mcpServer: McpServer, provider: ClineProvider) {
	mcpServer.tool("get_execution_trace", {}, async () => {
		try {
			const snapshot = diagnosticsManager.getSnapshot()
			return {
				content: [{ type: "text", text: JSON.stringify(snapshot.taskTraces, null, 2) }],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_performance_metrics", {}, async () => {
		try {
			const snapshot = diagnosticsManager.getSnapshot()
			return {
				content: [{ type: "text", text: JSON.stringify(snapshot.metrics, null, 2) }],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("clear_diagnostics", {}, async () => {
		try {
			diagnosticsManager.clear()
			return { content: [{ type: "text", text: "Diagnostics cleared." }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
}
