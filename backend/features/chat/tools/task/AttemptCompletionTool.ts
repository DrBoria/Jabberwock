import { JabberwockEventName, IntentType, IntentStatus } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { formatResponse } from "@features/settings"
import type { ToolUse } from "@shared/tools"

import type { ITaskModel } from "@features/chat/task"
import { createTool, ToolCallbacks } from "@features/chat/tools/tool"
import { getStore } from "@features/singleton"
import { normalizeCompletionText } from "@utils/text"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { ask } from "@features/chat/task/notifications/actions/ask"
import {
	validateAttemptCompletionPreConditions,
	resolveSubtaskDelegation,
} from "@features/chat/tools/engine/lifecycle/index"

interface AttemptCompletionParams {
	result: string
	command?: string
}

export interface AttemptCompletionCallbacks extends ToolCallbacks {
	askFinishSubTaskApproval: () => Promise<boolean>
	toolDescription: () => string
}

function getTaskForCommit(
	task: ITaskModel,
): ITaskModel & { commitChanges: () => Promise<void>; emitFinalTokenUsageUpdate: () => void } {
	return task as ITaskModel & { commitChanges: () => Promise<void>; emitFinalTokenUsageUpdate: () => void }
}

export const attemptCompletionTool = createTool<"attempt_completion">({
	name: "attempt_completion" as const,

	async execute(
		params: AttemptCompletionParams,
		task: ITaskModel,
		callbacks: AttemptCompletionCallbacks,
	): Promise<void> {
		const { result } = params
		// Weak models sometimes wrap the result in a JSON envelope (e.g.
		// {"result":"PONG-42"}) — unwrap it so the say renders clean text.
		const normalizedResult = normalizeCompletionText(result)
		const { handleError, pushToolResult, askFinishSubTaskApproval } = callbacks

		const preConditionError = await validateAttemptCompletionPreConditions(task, normalizedResult, pushToolResult)
		if (preConditionError) {
			await emitBroadcast("system", task.taskId, "error", preConditionError)
			pushToolResult(formatResponse.toolError(preConditionError))
			return
		}

		try {
			task._state.setCompletionResultSummary(normalizedResult)
			task._state.setIsCompleted(true)
			getStore().chat.setIsCompleted(true)
			getStore().intentStore.createIntent({
				id: crypto.randomUUID(),
				type: IntentType.TaskCompletionRequested,
				payload: { taskId: task.taskId },
				status: IntentStatus.Queued,
				createdAt: Date.now(),
			})

			task._state.setConsecutiveMistakeCount(0)

			if (task._state.abort) {
				pushToolResult(formatResponse.toolResult("Task was aborted."))
				return
			}

			await emitBroadcast("agent", task.taskId, "completion_result", normalizedResult, undefined, false)

			if (task.parentTaskId) {
				const shouldReturn = await resolveSubtaskDelegation(
					task,
					normalizedResult,
					askFinishSubTaskApproval,
					pushToolResult,
					() => emitTaskCompleted(task),
				)
				if (shouldReturn) return
			}

			const { response, text, images } = await ask(task.taskId, "completion_result", "", false)

			if (response === "yesButtonClicked") {
				try {
					await getTaskForCommit(task).commitChanges()
				} catch (error) {
					const commitErrorMsg = `Failed to commit changes to disk: ${error instanceof Error ? error.message : String(error)}`
					await emitBroadcast("system", task.taskId, "error", commitErrorMsg)
					pushToolResult(formatResponse.toolError(commitErrorMsg))
					return
				}
				emitTaskCompleted(task)
				return
			}

			await emitBroadcast("user", task.taskId, "user_feedback", text ?? "", images)
			const feedbackText = `<user_message>\n${text}\n</user_message>`
			pushToolResult(formatResponse.toolResult(feedbackText, images))
		} catch (error) {
			await handleError("inspecting site", error as Error)
		}
	},

	async handlePartial(task: ITaskModel, block: ToolUse<"attempt_completion">): Promise<void> {
		const result: string | undefined = block.params.result
		const command: string | undefined = block.params.command

		const lastMessage = task.messages.at(-1)

		if (command) {
			if (lastMessage && lastMessage.ask === "command") {
				await ask(task.taskId, "command", command ?? "", block.partial).catch(() => {})
			} else {
				await emitBroadcast("agent", task.taskId, "completion_result", result ?? "", undefined, false)
				await ask(task.taskId, "command", command ?? "", block.partial).catch(() => {})
			}
		} else {
			await emitBroadcast("agent", task.taskId, "completion_result", result ?? "", undefined, block.partial)
		}
	},
})

function emitTaskCompleted(task: ITaskModel): void {
	getTaskForCommit(task).emitFinalTokenUsageUpdate()
	getTelemetryService().captureTaskCompleted(task.taskId)
	task.emit!(JabberwockEventName.TaskCompleted, task.taskId, task.tokenUsage!, task._state.toolUsage)
}
