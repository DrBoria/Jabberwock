/**
 * Extension-side model implementation for the Devtool wrapper.
 *
 * This file implements the DevtoolModel interface from @jabberwock/devtool,
 * registering domain-specific tools (task management, agent control, workspace
 * operations, etc.) on the MCP server alongside the generic tools provided by
 * the Devtool wrapper itself.
 *
 * Previously this logic was scattered across:
 *   - src/core/devtools/tools/taskTools/  (actions, status, history, polling, etc.)
 *   - src/core/devtools/tools/            (uiTools, stateTools, logTools, etc.)
 *
 * The generic tools (UI, diagnostics, state, settings, agent, prompt, provider)
 * have been moved into the @jabberwock/devtool package. This file only registers
 * the extension-specific (domain) tools that require direct access to ClineProvider.
 */

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { DevtoolModel } from "@jabberwock/devtool"
import type { ClineProvider } from "../webview/ClineProvider"

import { registerActionsTools } from "./tools/taskTools/actions"
import { registerStatusTools } from "./tools/taskTools/status"
import { registerHistoryTools } from "./tools/taskTools/history"
import { registerPollingTools } from "./tools/taskTools/polling"
import { registerWorkspaceTools } from "./tools/taskTools/workspace"
import { registerTodoTools } from "./tools/taskTools/todoTools"
import { registerUiTools } from "./tools/uiTools"

/**
 * Creates a DevtoolModel implementation for the given ClineProvider.
 * This is the "Extension" part of the <Devtool><Extension/></Devtool> pattern.
 */
export function createDevtoolModel(provider: ClineProvider): DevtoolModel {
	return {
		registerTools(mcpServer: McpServer): void {
			registerActionsTools(mcpServer, provider)
			registerStatusTools(mcpServer, provider)
			registerHistoryTools(mcpServer, provider)
			registerPollingTools(mcpServer, provider)
			registerWorkspaceTools(mcpServer, provider)
			registerTodoTools(mcpServer, provider)
			registerUiTools(mcpServer, provider)

			// Register _ping tool for health checks (used by smoke tests)
			mcpServer.tool("_ping", {}, async () => {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								providerAlive: true,
								taskId: provider.getCurrentTask()?.taskId || null,
							}),
						},
					],
				}
			})
		},
	}
}
