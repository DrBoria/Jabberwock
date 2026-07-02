import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ITaskModel } from "@features/chat/task/store"
import { ToolUse } from "@shared/tools"
import { formatResponse } from "@features/settings/context/responses"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { getTask } from "@features/chat/task/actions/taskRegistry"

/**
 * Builds a summary string of batch completion results from child tasks.
 */
function buildBatchResultsSummary(heading: string, children: ITaskModel[], withTimedOut: boolean): string {
	let resultStr = `${heading}:\n`
	for (const child of children) {
		resultStr += `\nTask [${child.taskId}]:\n`
		if (withTimedOut && !child._state.isCompleted) {
			resultStr += "still running\n"
		} else {
			resultStr += `${child._state.completionResultSummary || "No summary provided."}\n`
		}
	}
	return resultStr
}

/**
 * Polls for child task completion with a 5-minute timeout.
 * Returns a result string, or undefined if already handled.
 */
async function pollForChildrenCompletion(children: ITaskModel[]): Promise<string | undefined> {
	const deadline = Date.now() + 300_000 // 5 minute timeout
	let pollCount = 0

	while (Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 2000))
		pollCount++

		const stillPending = children.filter((c: ITaskModel) => !c._state.isCompleted)
		if (stillPending.length === 0) {
			return buildBatchResultsSummary("Batch completion results", children, false)
		}

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

	let resultStr = "Batch completion timed out after 5 minutes.\n"
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
	return resultStr
}

export class AwaitBatchCompletionTool extends BaseTool<"await_batch_completion"> {
	readonly name = "await_batch_completion" as const

	async execute(params: Record<string, never>, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, askApproval } = callbacks

		try {
			const didApprove = await askApproval("tool", JSON.stringify({ tool: "await_batch_completion" }))
			if (!didApprove) {
				return
			}

			const children = task.childTaskIds.map((id: string) => getTask(id))
			const pendingChildren = children.filter((c: ITaskModel) => !c._state.isCompleted)

			if (pendingChildren.length === 0) {
				pushToolResult(buildBatchResultsSummary("Batch completion results", children, false))
				return
			}

			pushToolResult(
				`Waiting for ${pendingChildren.length} background tasks to complete... Polling for completion.`,
			)

			const result = await pollForChildrenCompletion(children)
			if (result) {
				pushToolResult(result)
			}
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
