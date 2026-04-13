import { registerStatusTools } from "./status"
import { registerHistoryTools } from "./history"
import { registerPollingTools } from "./polling"
import { registerWorkspaceTools } from "./workspace"

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"

export const registerTaskTools = (mcpServer: McpServer, provider: ClineProvider) => {
	registerStatusTools(mcpServer, provider)
	registerHistoryTools(mcpServer, provider)
	registerPollingTools(mcpServer, provider)
	registerWorkspaceTools(mcpServer, provider)
}
