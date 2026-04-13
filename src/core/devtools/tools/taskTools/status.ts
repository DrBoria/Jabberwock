import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"
import { type Task } from "../../../task/Task"

export const registerStatusTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool("get_task_status", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) {
				return { content: [{ type: "text", text: JSON.stringify({ hasTask: false }) }] }
			}

			const lastMessage = currentTask.clineMessages.at(-1)
			const status = {
				hasTask: true,
				taskId: currentTask.taskId,
				currentMode: currentTask.taskMode,
				isStreaming: currentTask.isStreaming,
				isWaitingForFirstChunk: currentTask.isWaitingForFirstChunk,
				isCompleted: currentTask.isCompleted,
				messageCount: currentTask.clineMessages.length,
				lastMessageType: lastMessage?.type,
				lastMessageAsk: lastMessage?.ask,
				lastMessageSay: lastMessage?.say,
				lastMessagePartial: lastMessage?.partial,
				todoList: currentTask.todoList,
			}

			return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting task status: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_child_tasks", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) {
				return { content: [{ type: "text", text: "No active task" }], isError: true }
			}

			const children = currentTask.childTasks || []
			const childInfo = children.map((child: Task) => ({
				taskId: child.taskId,
				mode: child.taskMode,
				isCompleted: child.isCompleted,
				completionResultSummary: child.completionResultSummary,
				messageCount: child.clineMessages.length,
			}))

			return { content: [{ type: "text", text: JSON.stringify(childInfo, null, 2) }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting child tasks: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_task_hierarchy", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) {
				return { content: [{ type: "text", text: "No active task" }], isError: true }
			}

			// Using recursive type for strict mode compliance without any
			const buildHierarchy = (task: Task): unknown => {
				return {
					taskId: task.taskId,
					mode: task.taskMode,
					isCompleted: task.isCompleted,
					messageCount: task.clineMessages.length,
					children: (task.childTasks || []).map((t: Task) => buildHierarchy(t)),
				}
			}

			const root = currentTask.rootTask || currentTask
			const hierarchy = buildHierarchy(root)

			return { content: [{ type: "text", text: JSON.stringify(hierarchy, null, 2) }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting task hierarchy: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_task_details", { taskId: z.string() }, async ({ taskId }) => {
		try {
			// Search for the task in the ClineProvider's task inventory
			// We can search the current task and its descendants, or the root and its descendants
			const currentRoot = provider.getCurrentTask()?.rootTask || provider.getCurrentTask()
			if (!currentRoot) {
				return { content: [{ type: "text", text: "No active task" }], isError: true }
			}

			const findTask = (task: Task, id: string): Task | undefined => {
				if (task.taskId === id) return task
				for (const child of task.childTasks || []) {
					const found = findTask(child, id)
					if (found) return found
				}
				return undefined
			}

			const targetTask = findTask(currentRoot, taskId)
			if (!targetTask) {
				return { content: [{ type: "text", text: `Task with ID ${taskId} not found` }], isError: true }
			}

			const lastMessage = targetTask.clineMessages.at(-1)
			const details = {
				taskId: targetTask.taskId,
				mode: targetTask.taskMode,
				isCompleted: targetTask.isCompleted,
				messageCount: targetTask.clineMessages.length,
				lastMessageType: lastMessage?.type,
				lastMessageAsk: lastMessage?.ask,
				lastMessageSay: lastMessage?.say,
				todoList: targetTask.todoList,
				isStreaming: targetTask.isStreaming,
			}

			return { content: [{ type: "text", text: JSON.stringify(details, null, 2) }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting task details: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"get_tool_calls",
		{
			taskId: z
				.string()
				.optional()
				.describe("Optional: specific task ID. Omit for current task and its children."),
		},
		async ({ taskId }) => {
			try {
				const currentRoot = provider.getCurrentTask()?.rootTask || provider.getCurrentTask()
				if (!currentRoot) {
					return { content: [{ type: "text", text: "No active task" }], isError: true }
				}

				const collectToolUsage = (task: Task): unknown => {
					const childResults = (task.childTasks || []).map((child: Task) => collectToolUsage(child))
					return {
						taskId: task.taskId,
						mode: task.taskMode,
						toolUsage: task.toolUsage,
						children: childResults,
					}
				}

				if (taskId) {
					const findTask = (task: Task, id: string): Task | undefined => {
						if (task.taskId === id) return task
						for (const child of task.childTasks || []) {
							const found = findTask(child, id)
							if (found) return found
						}
						return undefined
					}

					const targetTask = findTask(currentRoot, taskId)
					if (!targetTask) {
						return { content: [{ type: "text", text: `Task with ID ${taskId} not found` }], isError: true }
					}
					return { content: [{ type: "text", text: JSON.stringify(collectToolUsage(targetTask), null, 2) }] }
				}

				return { content: [{ type: "text", text: JSON.stringify(collectToolUsage(currentRoot), null, 2) }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error getting tool calls: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)
}
