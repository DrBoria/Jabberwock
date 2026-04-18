import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"

export const registerPollingTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool(
		"wait_for_ask",
		{
			timeoutMs: z.number().optional().describe("Max time to wait in ms. Default is 30000 (30s)."),
			askType: z
				.string()
				.optional()
				.describe("Optional specific ask type to wait for (e.g. 'tool', 'followup')."),
		},
		async ({ timeoutMs = 30000, askType }) => {
			const startTime = Date.now()
			const POLL_INTERVAL = 500

			while (Date.now() - startTime < timeoutMs) {
				const currentTask = provider.getCurrentTask()
				if (currentTask) {
					const lastMessage = currentTask.clineMessages.at(-1)
					if (
						lastMessage?.type === "ask" &&
						!lastMessage.partial &&
						(!askType || lastMessage.ask === askType)
					) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify({
										found: true,
										askType: lastMessage.ask,
										text: lastMessage.text ? lastMessage.text.substring(0, 1000) : undefined,
										elapsedMs: Date.now() - startTime,
									}),
								},
							],
						}
					}
				}

				await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							found: false,
							reason: "timeout",
							elapsedMs: Date.now() - startTime,
						}),
					},
				],
			}
		},
	)

	mcpServer.tool(
		"wait_for_task_idle",
		{
			timeoutMs: z.number().optional().describe("Max time to wait in ms. Default is 60000 (60s)."),
		},
		async ({ timeoutMs = 60000 }) => {
			const startTime = Date.now()
			const POLL_INTERVAL = 1000

			while (Date.now() - startTime < timeoutMs) {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									idle: true,
									reason: "no_task",
									elapsedMs: Date.now() - startTime,
								}),
							},
						],
					}
				}

				const lastMessage = currentTask.clineMessages.at(-1)
				const isIdle = !currentTask.isStreaming && !currentTask.isWaitingForFirstChunk && !lastMessage?.partial

				if (isIdle) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									idle: true,
									reason: "not_streaming",
									taskId: currentTask.taskId,
									currentMode: currentTask.taskMode,
									isCompleted: currentTask.isCompleted,
									lastMessageType: lastMessage?.type,
									lastMessageAsk: lastMessage?.ask,
									elapsedMs: Date.now() - startTime,
								}),
							},
						],
					}
				}

				await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							idle: false,
							reason: "timeout",
							elapsedMs: Date.now() - startTime,
						}),
					},
				],
			}
		},
	)
}
