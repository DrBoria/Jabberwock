import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"

export const registerActionsTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool(
		"create_new_task",
		{
			text: z.string().describe("The task description to start"),
			mode: z.string().optional(),
			force: z.boolean().optional(),
		},
		async ({ text, mode, force }) => {
			try {
				const previousTaskId = provider.getCurrentTask()?.taskId

				// Fire and forget — do not await the task completion
				provider.createTask(text, undefined, undefined, { mode }).catch((error: any) => {
					provider.log(`[create_new_task] Error creating task: ${error.message}`)
				})

				// Poll for taskId change (up to 5 seconds)
				const taskId = await (async (): Promise<string> => {
					const startTime = Date.now()
					while (Date.now() - startTime < 5000) {
						await new Promise((resolve) => setTimeout(resolve, 200))
						const currentTask = provider.getCurrentTask()
						if (currentTask && currentTask.taskId !== previousTaskId) {
							return currentTask.taskId
						}
					}
					throw new Error("Task creation timed out")
				})()

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ message: `Task created successfully`, taskId }, null, 2),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error creating task: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"start_task",
		{
			text: z.string().describe("The task description to start"),
			mode: z.string().optional(),
			force: z.boolean().optional(),
		},
		async ({ text, mode, force }) => {
			try {
				const previousTaskId = provider.getCurrentTask()?.taskId

				// Fire and forget — do not await the task completion
				provider.createTask(text, undefined, undefined, { mode }).catch((error: any) => {
					provider.log(`[start_task] Error creating task: ${error.message}`)
				})

				// Poll for taskId change (up to 5 seconds)
				const taskId = await (async (): Promise<string> => {
					const startTime = Date.now()
					while (Date.now() - startTime < 5000) {
						await new Promise((resolve) => setTimeout(resolve, 200))
						const currentTask = provider.getCurrentTask()
						if (currentTask && currentTask.taskId !== previousTaskId) {
							return currentTask.taskId
						}
					}
					throw new Error("Task creation timed out")
				})()

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ message: `Task started successfully`, taskId }, null, 2),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error starting task: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool("clear_task", {}, async () => {
		try {
			await provider.clearTaskStack()
			return { content: [{ type: "text", text: "Task cleared" }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error clearing task: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool("pop_window", {}, async () => {
		try {
			await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
			return { content: [{ type: "text", text: "Window popped" }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error popping window: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"mark_task_async",
		{
			taskId: z.string().describe("The ID of the task to mark as async"),
		},
		async ({ taskId }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (currentTask && currentTask.taskId === taskId) {
					;(currentTask as any).isAsync = true
				}
				return {
					content: [{ type: "text", text: JSON.stringify({ message: `Task ${taskId} marked as async` }) }],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error marking task as async: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"wait_for_task_id",
		{
			timeoutMs: z.number().optional().describe("Max wait time in ms (default: 30000)"),
		},
		async ({ timeoutMs = 30000 }) => {
			try {
				const startTime = Date.now()
				while (Date.now() - startTime < timeoutMs) {
					const currentTask = provider.getCurrentTask()
					if (currentTask && currentTask.taskId) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify({ taskId: currentTask.taskId, message: "Task ID available" }),
								},
							],
						}
					}
					await new Promise((resolve) => setTimeout(resolve, 200))
				}
				throw new Error("Timeout waiting for task ID")
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error waiting for task ID: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"create_child_tasks",
		{
			tasks: z
				.array(
					z.object({
						message: z.string().describe("The task description"),
						mode: z.string().describe("The mode slug (e.g. 'code', 'architect')"),
						todos: z.string().optional().describe("Optional markdown checklist for todos"),
					}),
				)
				.describe("Array of child tasks to create in parallel"),
		},
		async ({ tasks }) => {
			try {
				const currentTask = provider.getCurrentTask()
				const parentTaskId = currentTask?.taskId
				if (!parentTaskId) {
					throw new Error("No active task to create child tasks under")
				}

				// Parse markdown checklist string into TodoItem[] format
				function parseTodos(
					todosStr?: string,
				): Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }> {
					if (!todosStr) return []
					const lines = todosStr.split("\n")
					const items: Array<{
						id: string
						content: string
						status: "pending" | "in_progress" | "completed"
					}> = []
					for (const line of lines) {
						const match = line.match(/^\s*[-*]\s*\[( |x|-)\]\s*(.+)$/)
						if (match) {
							const statusChar = match[1]
							const content = match[2].trim()
							const status =
								statusChar === "x" ? "completed" : statusChar === "-" ? "in_progress" : "pending"
							items.push({ id: `todo-${Date.now()}-${items.length}`, content, status })
						}
					}
					return items
				}

				const taskDefs = tasks.map((t: any) => ({
					message: t.message,
					mode: t.mode,
					initialTodos: parseTodos(t.todos),
				}))

				const results = await provider.createChildTasks({ parentTaskId, tasks: taskDefs })
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ message: "Child tasks created", tasks: results }, null, 2),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error creating child tasks: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"navigate_to_task",
		{
			taskId: z.string().describe("The ID of the task to navigate to"),
		},
		async ({ taskId }) => {
			try {
				// Pure UI navigation: post a message to the webview to scroll to / highlight the task
				// WITHOUT calling showTaskWithId (which creates a new Task from history).
				await provider.postMessageToWebview({
					type: "action",
					action: "chatButtonClicked",
				})
				// Also post the task ID so the webview can scroll to the specific task
				await provider.postMessageToWebview({
					type: "navigateToTask",
					taskId,
				} as any)
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ message: `Navigated to task ${taskId}`, taskId }, null, 2),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error navigating to task: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)
}
