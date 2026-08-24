import { JabberwockEventName, IntentType, IntentStatus } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { formatResponse } from "@features/settings/context/responses"
import type { ToolUse } from "@shared/tools"

import type { ITaskModel } from "@features/chat/task/store"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { getBackendRootStore } from "@features/storeSingleton"
import { agentBroadcast, systemBroadcast, userBroadcast } from "@features/chat/task/messages/actions/say"
import { ask } from "@features/chat/task/notifications/actions/ask"
import {
	validateAttemptCompletionPreConditions,
	resolveSubtaskDelegation,
} from "@features/chat/tools/helpers/lifecycle"

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

export class AttemptCompletionTool extends BaseTool<"attempt_completion"> {
	readonly name = "attempt_completion" as const

	async execute(
		params: AttemptCompletionParams,
		task: ITaskModel,
		callbacks: AttemptCompletionCallbacks,
	): Promise<void> {
		const { result } = params
		const { handleError, pushToolResult, askFinishSubTaskApproval } = callbacks

		const preConditionError = await validateAttemptCompletionPreConditions(task, result, pushToolResult)
		if (preConditionError) {
			await systemBroadcast(task.taskId, "error", preConditionError)
			pushToolResult(formatResponse.toolError(preConditionError))
			return
		}

		try {
			task._state.setCompletionResultSummary(result)
			task._state.setIsCompleted(true)
			getBackendRootStore().chat.setIsCompleted(true)
			getBackendRootStore().intentStore.createIntent({
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

			await agentBroadcast(task.taskId, "completion_result", result, undefined, false)

			if (task.parentTaskId) {
				const shouldReturn = await resolveSubtaskDelegation(
					task,
					result,
					askFinishSubTaskApproval,
					pushToolResult,
					() => this.emitTaskCompleted(task),
				)
				if (shouldReturn) return
			}

			const { response, text, images } = await ask(task.taskId, "completion_result", "", false)

			if (response === "yesButtonClicked") {
				try {
					await getTaskForCommit(task).commitChanges()
				} catch (error) {
					const commitErrorMsg = `Failed to commit changes to disk: ${error instanceof Error ? error.message : String(error)}`
					await systemBroadcast(task.taskId, "error", commitErrorMsg)
					pushToolResult(formatResponse.toolError(commitErrorMsg))
					return
				}
				this.emitTaskCompleted(task)
				return
			}

			await userBroadcast(task.taskId, "user_feedback", text ?? "", images)
			const feedbackText = `<user_message>\n${text}\n</user_message>`
			pushToolResult(formatResponse.toolResult(feedbackText, images))
		} catch (error) {
			await handleError("inspecting site", error as Error)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"attempt_completion">): Promise<void> {
		const result: string | undefined = block.params.result
		const command: string | undefined = block.params.command

		const lastMessage = task.messages.at(-1)

		if (command) {
			if (lastMessage && lastMessage.ask === "command") {
				await ask(task.taskId, "command", command ?? "", block.partial).catch(() => {})
			} else {
				await agentBroadcast(task.taskId, "completion_result", result ?? "", undefined, false)
				await ask(task.taskId, "command", command ?? "", block.partial).catch(() => {})
			}
		} else {
			await agentBroadcast(task.taskId, "completion_result", result ?? "", undefined, block.partial)
		}
	}

	private emitTaskCompleted(task: ITaskModel): void {
		getTaskForCommit(task).emitFinalTokenUsageUpdate()
		getTelemetryService().captureTaskCompleted(task.taskId)
		task.emit!(JabberwockEventName.TaskCompleted, task.taskId, task.tokenUsage!, task._state.toolUsage)
	}
}

export const attemptCompletionTool = new AttemptCompletionTool()
