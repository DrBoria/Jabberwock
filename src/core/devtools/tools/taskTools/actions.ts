import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"

export const registerActionsTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool(
		"create_new_task",
		{
			text: z.string().describe("The task description to start"),
			mode: z.string().optional().describe("The mode slug to use (e.g. 'orchestrator', 'coder')"),
		},
		async ({ text, mode }) => {
			try {
				if (mode) {
					await provider.handleModeSwitch(mode as any)
				}

				// createTask returns the Task instance
				const task = await provider.createTask(text, [], undefined)

				// Synchronize webview state to trigger view switch (e.g. from history/welcome to chat)
				await provider.postStateToWebview()

				// Ensure webview switches to chat tab using standard action
				await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									message: `Successfully initiated task in ${mode || "default"} mode`,
									taskId: task.taskId,
								},
								null,
								2,
							),
						},
					],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error initiating task: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	// Alias for backward compatibility
	mcpServer.tool(
		"start_task",
		{
			text: z.string().describe("The task description to start"),
			mode: z.string().optional().describe("The mode slug to use (e.g. 'orchestrator', 'coder')"),
		},
		async (args) => {
			return await (mcpServer as any).callTool("create_new_task", args)
		},
	)

	mcpServer.tool("clear_task", {}, async () => {
		try {
			await provider.clearTask()
			return {
				content: [
					{
						type: "text",
						text: "Successfully cleared the current task stack.",
					},
				],
			}
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

	// Alias for backward compatibility or DSL requirements
	mcpServer.tool("pop_window", {}, async () => {
		try {
			// For E2E DSL, pop_window often means "go back to chat" or "reset view"
			await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
			return { content: [{ type: "text", text: "Successfully popped window (switched to chat view)." }] }
		} catch (error) {
			return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
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
				if (!currentTask) {
					return {
						content: [{ type: "text", text: JSON.stringify({ hasTask: false, error: "No active task" }) }],
					}
				}

				// Find the task by ID in the hierarchy
				const findTask = (task: any, id: string): any => {
					if (task.taskId === id) return task
					if (task.childTasks) {
						for (const child of task.childTasks) {
							const found = findTask(child, id)
							if (found) return found
						}
					}
					return null
				}

				const root = currentTask.rootTask || currentTask
				const target = findTask(root, taskId)
				if (!target) {
					return { content: [{ type: "text", text: `Task ${taskId} not found` }], isError: true }
				}

				// Mark the task as async
				target.isAsync = true
				return { content: [{ type: "text", text: `Task ${taskId} marked as async` }] }
			} catch (error) {
				return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
			}
		},
	)
}
