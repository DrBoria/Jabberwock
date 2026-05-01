import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"
import { diagnosticsManager } from "../../DiagnosticsManager"

export const registerActionsTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool(
		"create_new_task",
		{
			text: z.string().describe("The task description to start"),
			mode: z.string().optional().describe("The mode slug to use (e.g. 'orchestrator', 'coder')"),
			force: z.boolean().optional().describe("Clear existing task before creating new one (default: false)"),
		},
		async ({ text, mode, force }) => {
			try {
				if (force) {
					await provider.clearTask()
				}

				if (mode) {
					await provider.handleModeSwitch(mode as any)
				}

				// Clear accumulated diagnostics (logs, metrics, traces) for a fresh start
				diagnosticsManager.clear()

				// Capture the previous taskId BEFORE creating a new task, so the
				// polling loop below can distinguish the new task from the old one.
				const previousTask = provider.getCurrentTask()
				const previousTaskId = previousTask?.taskId

				// createTask is heavy — it creates a Task instance and starts the
				// full task loop (API calls, streaming, etc.). Don't await it so
				// the MCP tool returns immediately and the SSE client doesn't hit
				// the 60 s timeout. The task will show up in the UI once it starts
				// processing.
				const taskPromise = provider.createTask(text, [], undefined, { mode })

				// Fire post-state and chat-button-clicked asynchronously.
				// postStateToWebview() is heavy (cloud orgs, MCP servers, task
				// history…) and doesn't need to block the MCP tool response.
				taskPromise.then(async () => {
					await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" }).catch(() => {})
				})

				// Poll for the real taskId. We compare against previousTaskId to
				// avoid returning a stale taskId on the second call (when the
				// extension reuses the same task instance).
				const taskId = await Promise.race([
					(async (): Promise<string> => {
						while (true) {
							const task = provider.getCurrentTask()
							if (task?.taskId && task.taskId !== previousTaskId) return task.taskId
							await new Promise((resolve) => setTimeout(resolve, 50))
						}
					})(),
					new Promise<string>((_, reject) =>
						setTimeout(() => reject(new Error("Timeout waiting for taskId")), 5000),
					),
				])

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									message: `Successfully initiated task in ${mode || "default"} mode`,
									taskId,
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

	// Alias for backward compatibility — delegates to create_new_task handler
	mcpServer.tool(
		"start_task",
		{
			text: z.string().describe("The task description to start"),
			mode: z.string().optional().describe("The mode slug to use (e.g. 'orchestrator', 'coder')"),
			force: z.boolean().optional().describe("Clear existing task before creating new one (default: false)"),
		},
		async ({ text, mode, force }) => {
			try {
				if (force) {
					await provider.clearTask()
				}

				if (mode) {
					await provider.handleModeSwitch(mode as any)
				}

				// Clear accumulated diagnostics (logs, metrics, traces) for a fresh start
				diagnosticsManager.clear()

				const taskPromise = provider.createTask(text, [], undefined, { mode })

				taskPromise.then(async () => {
					await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" }).catch(() => {})
				})

				const taskId = await Promise.race([
					(async (): Promise<string> => {
						while (true) {
							const task = provider.getCurrentTask()
							if (task?.taskId) return task.taskId
							await new Promise((resolve) => setTimeout(resolve, 50))
						}
					})(),
					new Promise<string>((_, reject) =>
						setTimeout(() => reject(new Error("Timeout waiting for taskId")), 5000),
					),
				])

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									message: `Successfully initiated task in ${mode || "default"} mode`,
									taskId,
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

	mcpServer.tool(
		"wait_for_task_id",
		{
			timeoutMs: z.number().optional().describe("Max wait time in ms (default: 30000)"),
		},
		async ({ timeoutMs = 30000 }) => {
			try {
				const deadline = Date.now() + timeoutMs
				while (Date.now() < deadline) {
					const currentTask = provider.getCurrentTask()
					if (currentTask?.taskId) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify({ taskId: currentTask.taskId }, null, 2),
								},
							],
						}
					}
					await new Promise((resolve) => setTimeout(resolve, 200))
				}
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ error: "Timeout waiting for task ID" }),
						},
					],
					isError: true,
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error waiting for task: ${error instanceof Error ? error.message : String(error)}`,
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
				if (!currentTask) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									hasTask: false,
									error: "No active task to create children for",
								}),
							},
						],
					}
				}

				// Parse todos for each task
				const taskDefs = tasks.map((t: any) => {
					let todoItems: any[] = []
					if (t.todos) {
						try {
							// Simple markdown checklist parsing
							const lines = t.todos.split("\n")
							for (const line of lines) {
								const match = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/)
								if (match) {
									todoItems.push({
										id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
										description: match[2],
										status: match[1] === " " ? "pending" : "completed",
									})
								}
							}
						} catch {
							// Ignore parse errors
						}
					}
					return {
						message: t.message,
						mode: t.mode,
						initialTodos: todoItems,
					}
				})

				const children = await provider.createChildTasks({
					parentTaskId: currentTask.taskId,
					tasks: taskDefs,
				})

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									message: `Created ${children.length} child tasks in parallel`,
									childTaskIds: children.map((c) => c.taskId),
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
							text: `Error creating child tasks: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)
}
