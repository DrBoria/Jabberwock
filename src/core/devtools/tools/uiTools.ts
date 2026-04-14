import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../webview/ClineProvider"
import { type ClineAskResponse } from "../../../shared/WebviewMessage"
import { type Mode } from "../../../shared/modes"

export function registerUiTools(mcpServer: McpServer, provider: ClineProvider) {
	mcpServer.tool(
		"interact_with_ui",
		{
			action: z
				.enum(["continue", "cancel"])
				.describe("Action to take: continue or cancel the current task generation"),
		},
		async ({ action }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return { content: [{ type: "text", text: "Error: No active task available" }], isError: true }
				}

				if (action === "continue") {
					await provider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
					return { content: [{ type: "text", text: "Successfully invoked primary button (Continue)." }] }
				} else if (action === "cancel") {
					await provider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
					return { content: [{ type: "text", text: "Successfully invoked secondary button (Cancel)." }] }
				}

				return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true }
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

	mcpServer.tool(
		"respond_to_ask",
		{
			response: z
				.enum(["yesButtonClicked", "noButtonClicked", "messageResponse", "objectResponse"])
				.describe("The type of response for the current question/ask"),
			text: z.string().optional().describe("Optional feedback text for the response"),
		},
		async ({ response, text }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return { content: [{ type: "text", text: "Error: No active task to respond to" }], isError: true }
				}

				// Programmatic MCP calls should bypass the 500ms fast-click prevention guard
				currentTask.askShownAt = undefined
				currentTask.handleWebviewAskResponse(response as ClineAskResponse, text, undefined)
				return {
					content: [{ type: "text", text: `Successfully sent response "${response}" to current task.` }],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error responding to task: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"switch_mode",
		{
			mode: z.string().describe("The slug of the mode to switch to (e.g. 'architect', 'coder', 'ask')"),
		},
		async ({ mode }) => {
			try {
				await provider.handleModeSwitch(mode as Mode)
				return { content: [{ type: "text", text: `Successfully switched to mode: ${mode}` }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error switching mode: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)
	mcpServer.tool("get_active_ask", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) {
				return { content: [{ type: "text", text: "No active task" }], isError: true }
			}

			const lastMessage = currentTask.clineMessages.at(-1)
			if (lastMessage?.type === "ask" && !lastMessage.partial) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									ask: lastMessage.ask,
									text: lastMessage.text,
									ts: lastMessage.ts,
								},
								null,
								2,
							),
						},
					],
				}
			}

			return { content: [{ type: "text", text: "No active ask message" }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting active ask: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_dom", {}, async () => {
		try {
			const dom = await provider.getWebviewDom()
			return { content: [{ type: "text", text: dom }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting DOM: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})
}
