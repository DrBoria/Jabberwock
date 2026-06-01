import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ITaskModel } from "../../../features/chat/task/store"
import { ToolUse } from "../../../shared/tools"
import { formatResponse } from "../../settings/context/responses"
import { ask } from "../task/notifications/actions/ask"
import { getTask } from "../../../features/chat/task/actions/taskRegistry"

export class AwaitBatchCompletionTool extends BaseTool<"await_batch_completion"> {
	readonly name = "await_batch_completion" as const

	async execute(params: Record<string, never>, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, askApproval } = callbacks

		try {
			const didApprove = await askApproval("tool", JSON.stringify({ tool: "await_batch_completion" }))
			if (!didApprove) {
				return
			}

			// Jabberwock: Barrier Synchronization
			// We check the children tasks of this task
			const children = task.childTaskIds.map((id: string) => getTask(id))
			const pendingChildren = children.filter((c: ITaskModel) => !c._state.isCompleted)

			if (pendingChildren.length === 0) {
				// All completed!
				let resultStr = "Batch completion results:\n"
				for (const child of children) {
					resultStr += `\nTask [${child.taskId}]:\n${child._state.completionResultSummary || "No summary provided."}\n`
				}
				pushToolResult(resultStr)
				return
			}

			// Suspend orchestrator until children complete — poll with timeout
			pushToolResult(
				`Waiting for ${pendingChildren.length} background tasks to complete... Polling for completion.`,
			)

			const deadline = Date.now() + 300_000 // 5 minute timeout for batch completion
			let pollCount = 0

			while (Date.now() < deadline) {
				// Wait 2 seconds between polls
				await new Promise((resolve) => setTimeout(resolve, 2000))
				pollCount++

				// Re-check completion status from the in-memory childTasks
				const stillPending = children.filter((c: ITaskModel) => !c._state.isCompleted)

				if (stillPending.length === 0) {
					// All children completed!
					let resultStr = "Batch completion results:\n"
					for (const child of children) {
						resultStr += `\nTask [${child.taskId}]:\n${child._state.completionResultSummary || "No summary provided."}\n`
					}
					pushToolResult(resultStr)
					return
				}

				// Log progress every 30 seconds
				if (pollCount % 15 === 0) {
					const elapsed = Math.floor((Date.now() - (deadline - 300_000)) / 1000)
					console.log(
						`[AwaitBatchCompletionTool] Still waiting for ${stillPending.length}/${children.length} tasks after ${elapsed}s`,
					)
				}
			}

			// Timeout — return partial results
			const completedChildren = children.filter((c: ITaskModel) => c._state.isCompleted)
			const timedOutChildren = children.filter((c: ITaskModel) => !c._state.isCompleted)

			let resultStr = `Batch completion timed out after 5 minutes.\n`
			if (completedChildren.length > 0) {
				resultStr += `\nCompleted tasks (${completedChildren.length}):\n`
				for (const child of completedChildren) {
					resultStr += `\nTask [${child.taskId}]:\n${child._state.completionResultSummary || "No summary provided."}\n`
				}
			}
			if (timedOutChildren.length > 0) {
				resultStr += `\nTimed out tasks (${timedOutChildren.length}):\n`
				for (const child of timedOutChildren) {
					resultStr += `\nTask [${child.taskId}]: still running\n`
				}
			}
			pushToolResult(resultStr)
		} catch (error) {
			callbacks.handleError(
				"awaiting batch completion",
				error instanceof Error ? error : new Error(String(error)),
			)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"await_batch_completion">): Promise<void> {
		const partialMessage = JSON.stringify({ tool: "await_batch_completion" })
		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})
	}
}

export const awaitBatchCompletionTool = new AwaitBatchCompletionTool()
