import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"
import { type Task } from "../../../task/Task"
import { findTaskById } from "./utils"

export const registerUsageTools = (mcpServer: McpServer, provider: ClineProvider) => {
	const collectToolUsage = (task: Task): unknown => {
		return {
			taskId: task.taskId,
			mode: task.taskMode,
			toolUsage: task.toolUsage,
			children: (task.childTasks || []).map((child: Task) => collectToolUsage(child)),
		}
	}

	mcpServer.tool(
		"get_tool_calls",
		{
			taskId: z.string().optional().describe("Optional: specific task ID. Omit for full hierarchy."),
		},
		async ({ taskId }) => {
			try {
				const current = provider.getCurrentTask()
				const root = current?.rootTask || current
				if (!root) return { content: [{ type: "text", text: "No active task" }], isError: true }

				const target = taskId ? findTaskById(root, taskId) : root
				if (!target) return { content: [{ type: "text", text: `Task ${taskId} not found` }], isError: true }

				return { content: [{ type: "text", text: JSON.stringify(collectToolUsage(target), null, 2) }] }
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
