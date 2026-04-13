import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"

export const registerHistoryTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool(
		"get_chat_messages",
		{
			count: z.number().optional().describe("Number of recent messages to return. Default is 20."),
		},
		async ({ count = 20 }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return { content: [{ type: "text", text: "No active task" }], isError: true }
				}

				const messages = currentTask.clineMessages.slice(-Math.abs(count))
				const sanitized = messages.map((msg) => ({
					ts: msg.ts,
					type: msg.type,
					ask: msg.ask,
					say: msg.say,
					partial: msg.partial,
					text: msg.text ? msg.text.substring(0, 500) : undefined,
				}))

				return { content: [{ type: "text", text: JSON.stringify(sanitized, null, 2) }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error getting messages: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"get_conversation_history",
		{
			count: z.number().optional().describe("Number of recent messages to return. Default is 10."),
		},
		async ({ count = 10 }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return { content: [{ type: "text", text: "No active task" }], isError: true }
				}

				const history = currentTask.apiConversationHistory
				const recent = history.slice(-Math.abs(count))

				const simplified = recent.map((msg, idx: number) => {
					const blocks = Array.isArray(msg.content)
						? msg.content.map((b: NonNullable<unknown>) => {
								if ("type" in b && "text" in b && b.type === "text") {
									const text = String(b.text || "")
									return { type: "text", preview: text.substring(0, 300) }
								}
								if ("type" in b && b.type === "tool_use" && "name" in b && "id" in b) {
									return {
										type: "tool_use",
										name: b.name,
										id: b.id,
										inputPreview: JSON.stringify("input" in b ? b.input : {}).substring(0, 200),
									}
								}
								if ("type" in b && b.type === "tool_result" && "tool_use_id" in b) {
									const content = String("content" in b ? b.content : "")
									return {
										type: "tool_result",
										tool_use_id: b.tool_use_id,
										contentPreview: content.substring(0, 200),
									}
								}
								return { type: "type" in b ? String(b.type) : "unknown" }
							})
						: [{ type: "text", preview: String(msg.content).substring(0, 300) }]

					return {
						index: history.length - recent.length + idx,
						role: msg.role,
						blockCount: blocks.length,
						blocks,
					}
				})

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ totalMessages: history.length, showing: recent.length, messages: simplified },
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
							text: `Error getting conversation history: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"get_api_history",
		{
			count: z.number().optional().describe("Number of recent messages to return. Default is 20."),
			fullContent: z
				.boolean()
				.optional()
				.describe("If true, return full content without truncation. Default is false."),
		},
		async ({ count = 20, fullContent = false }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return { content: [{ type: "text", text: "No active task" }], isError: true }
				}

				const history = currentTask.apiConversationHistory
				const recent = history.slice(-Math.abs(count))
				const maxPreview = fullContent ? 50000 : 2000

				const detailed = recent.map((msg, idx: number) => {
					const blocks = Array.isArray(msg.content)
						? msg.content.map((b: NonNullable<unknown>) => {
								if ("type" in b && "text" in b && b.type === "text") {
									const text = String(b.text || "")
									return { type: "text", text: text.substring(0, maxPreview) }
								}
								if ("type" in b && b.type === "tool_use" && "name" in b && "id" in b) {
									return {
										type: "tool_use",
										name: b.name,
										id: b.id,
										input: "input" in b ? b.input : {},
									}
								}
								if ("type" in b && b.type === "tool_result" && "tool_use_id" in b) {
									const content = String("content" in b ? b.content : "")
									return {
										type: "tool_result",
										tool_use_id: b.tool_use_id,
										content: content.substring(0, maxPreview),
									}
								}
								return { type: "type" in b ? String(b.type) : "unknown" }
							})
						: [{ type: "text", text: String(msg.content).substring(0, maxPreview) }]

					return {
						index: history.length - recent.length + idx,
						role: msg.role,
						blockCount: blocks.length,
						blocks,
					}
				})

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{ totalMessages: history.length, showing: recent.length, messages: detailed },
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
							text: `Error getting API history: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)
}
