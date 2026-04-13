import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"

export const registerActionsTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool(
		"start_task",
		{
			text: z.string().describe("The task description to start"),
			mode: z.string().optional().describe("The mode slug to use (e.g. 'orchestrator', 'coder')"),
		},
		async ({ text, mode }) => {
			try {
				if (mode) {
					// We use any because Mode type might be complex to import and validate here,
					// and we're in a dev mode.
					await provider.handleModeSwitch(mode as any)
				}

				// createTask is the primary way to start a task from the provider
				await provider.createTask(text, [], undefined)

				return {
					content: [
						{
							type: "text",
							text: `Successfully initiated task in ${mode || "default"} mode: ${text}`,
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
}
