import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"
import { registerStatusTools as registerBaseStatusTools } from "./statusTools"
import { registerHierarchyTools } from "./hierarchyTools"
import { registerUsageTools } from "./usageTools"

/**
 * Entry point for task status and hierarchy tools.
 * Delegated to specialized modules to maintain small file sizes (<150 lines).
 */
export const registerStatusTools = (mcpServer: McpServer, provider: ClineProvider) => {
	registerBaseStatusTools(mcpServer, provider)
	registerHierarchyTools(mcpServer, provider)
	registerUsageTools(mcpServer, provider)
}
