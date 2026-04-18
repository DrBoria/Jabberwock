import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../webview/ClineProvider"
import { registerLogTools } from "./logTools"
import { registerStateTools } from "./stateTools"
import { registerTraceTools } from "./traceTools"

/**
 * Entry point for diagnostic-related MCP tools.
 * Delegates to specialized modules to maintain small file sizes (<150 lines).
 */
export function registerDiagnosticTools(mcpServer: McpServer, provider: ClineProvider) {
	registerLogTools(mcpServer, provider)
	registerStateTools(mcpServer, provider)
	registerTraceTools(mcpServer, provider)
}
