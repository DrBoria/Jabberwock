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
				await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
				await provider.createTask(prompt, undefined, undefined, { mode })
				return { content: [{ type: "text", text: `Successfully started new task with prompt: "${prompt}"` }] }
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
				return { content: [{ type: "text", text: "No active task" }], isError: true }
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
}
