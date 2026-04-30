import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"
import { virtualWorkspace } from "../../../fs/VirtualWorkspace"

export const registerWorkspaceTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool(
		"send_chat_request",
		{
			prompt: z.string().describe("The text of the request to send to Jabberwock (starts a new task)"),
			mode: z
				.string()
				.optional()
				.describe("Optional: slug of the mode to start the task in (e.g. 'orchestrator', 'coder')"),
		},
		async ({ prompt, mode }) => {
			try {
				// 1. Clear current view to ensure focus on the new task
				await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })

				// 2. Create and start new task
				const task = await provider.createTask(prompt, undefined, undefined, { mode })

				// 3. Instruct webview to focus on the new task ID and switch to chat tab
				await provider.postMessageToWebview({
					type: "action",
					action: "switchTab",
					tab: "chat",
				})

				await provider.postMessageToWebview({
					type: "state",
					state: {
						currentTaskId: task.taskId,
						clineMessages: task.clineMessages,
					},
				} as any)

				return {
					content: [
						{
							type: "text",
							text: `Successfully started new task with prompt: "${prompt}" (ID: ${task.taskId})`,
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

	mcpServer.tool("get_virtual_files", {}, async () => {
		try {
			const files = virtualWorkspace.vol.toJSON()
			return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting virtual files: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_checkpoint_info", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) {
				return {
					content: [{ type: "text", text: JSON.stringify({ hasTask: false, checkpoints: [], count: 0 }) }],
				}
			}

			const checkpoints = currentTask.checkpointService?.getCheckpoints() || []
			const baseHash = currentTask.checkpointService?.baseHash

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								taskId: currentTask.taskId,
								baseHash,
								checkpoints,
								count: checkpoints.length,
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
						text: `Error getting checkpoint info: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"get_workspace_state",
		{
			fields: z
				.string()
				.describe(
					"Comma-separated list of fields to return (e.g. 'mode,autoApprovalEnabled,customModes'). Required — use '*' to return all non-sensitive fields.",
				),
		},
		async ({ fields }: { fields: string }) => {
			try {
				// Add a timeout to prevent hanging for 60s when provider.getState() is slow
				const state = await Promise.race([
					provider.getState(),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error("getState timed out after 10s")), 10_000),
					),
				])
				// Strip sensitive configuration (contains API keys)
				const { apiConfiguration, ...safeRest } = state as any

				// If fields is '*', return only the most essential diagnostic fields
				if (fields === "*") {
					const essentialFields = [
						"mode",
						"autoApprovalEnabled",
						"customModes",
						"mcpEnabled",
						"devtoolEnabled",
						"currentApiConfigName",
						"apiModelId",
						"language",
						"diagnosticsEnabled",
						"telemetrySetting",
						"locatorTarget",
					]
					const essential: Record<string, unknown> = {}
					for (const key of essentialFields) {
						if (key in safeRest) {
							essential[key] = (safeRest as any)[key]
						}
					}
					return { content: [{ type: "text", text: JSON.stringify(essential, null, 2) }] }
				}

				// Otherwise filter to only requested fields
				const fieldList = fields.split(",").map((f: string) => f.trim())
				const safeState: Record<string, unknown> = {}
				for (const field of fieldList) {
					if (field in safeRest) {
						safeState[field] = (safeRest as any)[field]
					}
				}

				return { content: [{ type: "text", text: JSON.stringify(safeState, null, 2) }] }
			} catch (error) {
				return { content: [{ type: "text", text: `Error: ${error}` }], isError: true }
			}
		},
	)
}
