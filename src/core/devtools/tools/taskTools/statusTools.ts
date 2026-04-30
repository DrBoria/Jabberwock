import { z } from "zod"
import { findTaskById, getTaskSummary } from "./utils"

export const registerStatusTools = (mcpServer, provider) => {
	mcpServer.tool("get_task_status", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask) return { content: [{ type: "text", text: JSON.stringify({ hasTask: false }) }] }

			const lastMessage = currentTask.clineMessages.at(-1)
			// Flat summary — no nested todoList with descriptions, no message history
			const status = {
				hasTask: true,
				taskId: currentTask.taskId,
				mode: currentTask.taskMode,
				isCompleted: currentTask.isCompleted,
				isStreaming: currentTask.isStreaming,
				messageCount: currentTask.clineMessages.length,
				todoCount: currentTask.todoList?.length ?? 0,
				lastMessageType: lastMessage?.type || null,
				lastMessageAsk: lastMessage?.ask || null,
				lastMessageSay: lastMessage?.say || null,
				pendingAction: currentTask.idleAsk?.ask || currentTask.resumableAsk?.ask || null,
			}
			return {
				content: [{ type: "text", text: JSON.stringify(status) }],
			}
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool("get_task_summary", {}, async () => {
		try {
			const currentTask = provider.getCurrentTask()
			if (!currentTask)
				return { content: [{ type: "text", text: JSON.stringify({ hasTask: false, summaryScore: 0 }) }] }

			const summary = getTaskSummary(currentTask)
			// summaryScore is a convenient metric for E2E tests: msgCount + todoCount
			const summaryScore = (currentTask.clineMessages.length || 0) + (currentTask.todoList?.length || 0)

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								hasTask: true,
								summaryScore,
								...summary,
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
	mcpServer.tool("get_task_details", { taskId: z.string() }, async ({ taskId }) => {
		try {
			const root = provider.getCurrentTask()?.rootTask || provider.getCurrentTask()
			if (!root)
				return {
					content: [{ type: "text", text: JSON.stringify({ hasTask: false, error: "No active task" }) }],
				}
			const target = findTaskById(root, taskId)
			if (!target) return { content: [{ type: "text", text: `Task ${taskId} not found` }], isError: true }
			return { content: [{ type: "text", text: JSON.stringify(getTaskSummary(target), null, 2) }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})
}
