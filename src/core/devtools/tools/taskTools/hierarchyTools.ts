import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"
import { type Task } from "../../../task/Task"
import { buildHierarchyData } from "./utils"

export const registerHierarchyTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool("get_child_tasks", {}, async () => {
		try {
			const current = provider.getCurrentTask()
			if (!current) return { content: [{ type: "text", text: "No active task" }], isError: true }
			const children = (current.childTasks || []).map((child: Task) => ({
				taskId: child.taskId,
				mode: child.taskMode,
				isCompleted: child.isCompleted,
				messageCount: child.clineMessages.length,
			}))
			return { content: [{ type: "text", text: JSON.stringify(children, null, 2) }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_task_hierarchy", {}, async () => {
		try {
			const current = provider.getCurrentTask()
			if (!current) return { content: [{ type: "text", text: "No active task" }], isError: true }
			const root = current.rootTask || current
			return { content: [{ type: "text", text: JSON.stringify(buildHierarchyData(root), null, 2) }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
}
