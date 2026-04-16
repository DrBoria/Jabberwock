import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../../webview/ClineProvider"

export const registerTodoTools = (mcpServer: McpServer, provider: ClineProvider) => {
	mcpServer.tool("get_todo_list_state", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) {
				return { content: [{ type: "text", text: "No active task" }], isError: true }
			}

			const todoList = currentTask.todoList || []
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								taskId: currentTask.taskId,
								mode: currentTask.taskMode,
								todoCount: todoList.length,
								items: todoList,
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_history_token_audit", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) {
				return { content: [{ type: "text", text: "No active task" }], isError: true }
			}

			const history = currentTask.apiConversationHistory
			let totalChars = 0
			const roleCounts = { user: 0, assistant: 0 }
			const roleChars = { user: 0, assistant: 0 }
			const toolUseNames: string[] = []
			const toolResultIds: string[] = []

			for (const msg of history) {
				const role = msg.role as "user" | "assistant"
				roleCounts[role] = (roleCounts[role] || 0) + 1

				if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						const b = block as NonNullable<unknown> as Record<string, unknown>
						if (b.type === "text" && typeof b.text === "string") {
							const len = (b.text as string).length
							totalChars += len
							roleChars[role] = (roleChars[role] || 0) + len
						}
						if (b.type === "tool_use" && typeof b.name === "string") {
							toolUseNames.push(b.name as string)
							const inputStr = JSON.stringify(b.input || {})
							totalChars += inputStr.length
							roleChars[role] += inputStr.length
						}
						if (b.type === "tool_result") {
							toolResultIds.push(b.tool_use_id as string)
							const contentStr =
								typeof b.content === "string" ? b.content : JSON.stringify(b.content || "")
							totalChars += contentStr.length
							roleChars[role] += contentStr.length
						}
					}
				} else if (typeof msg.content === "string") {
					totalChars += msg.content.length
					roleChars[role] += msg.content.length
				}
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								totalMessages: history.length,
								totalChars,
								roleCounts,
								roleChars,
								toolUseNames,
								toolResultIds,
								// Flag duplicate tool results as a known bug indicator
								duplicateToolResults: toolResultIds.filter(
									(id, idx) => toolResultIds.indexOf(id) !== idx,
								),
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"search_history_for_text",
		{
			query: z.string().describe("Substring to search for in all apiConversationHistory messages"),
			caseSensitive: z.boolean().optional().describe("Whether to match case. Default is false."),
		},
		async ({ query, caseSensitive = false }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return { content: [{ type: "text", text: "No active task" }], isError: true }
				}

				const history = currentTask.apiConversationHistory
				const searchQuery = caseSensitive ? query : query.toLowerCase()
				const matches: { messageIndex: number; role: string; blockType: string; preview: string }[] = []

				for (let i = 0; i < history.length; i++) {
					const msg = history[i]
					if (Array.isArray(msg.content)) {
						for (const block of msg.content) {
							const b = block as NonNullable<unknown> as Record<string, unknown>
							let textToSearch = ""

							if (b.type === "text" && typeof b.text === "string") {
								textToSearch = b.text as string
							} else if (b.type === "tool_use") {
								textToSearch = JSON.stringify(b.input || {})
							} else if (b.type === "tool_result") {
								textToSearch =
									typeof b.content === "string" ? b.content : JSON.stringify(b.content || "")
							}

							const normalizedText = caseSensitive ? textToSearch : textToSearch.toLowerCase()
							if (normalizedText.includes(searchQuery)) {
								const matchIdx = normalizedText.indexOf(searchQuery)
								const start = Math.max(0, matchIdx - 50)
								const end = Math.min(textToSearch.length, matchIdx + query.length + 50)
								matches.push({
									messageIndex: i,
									role: msg.role,
									blockType: String(b.type),
									preview: textToSearch.substring(start, end),
								})
							}
						}
					} else if (typeof msg.content === "string") {
						const normalizedContent = caseSensitive ? msg.content : msg.content.toLowerCase()
						if (normalizedContent.includes(searchQuery)) {
							matches.push({
								messageIndex: i,
								role: msg.role,
								blockType: "string",
								preview: msg.content.substring(0, 100),
							})
						}
					}
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									query,
									found: matches.length > 0,
									matchCount: matches.length,
									matches,
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
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)
}
