import * as vscode from "vscode"

import { JabberwockEventName, type HistoryItem, IntentType, IntentStatus } from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

import type { ITaskModel } from "../../../features/chat/task/store"
import { formatResponse } from "../../settings/context/responses"
import { Package } from "../../../shared/package"
import type { ToolUse } from "../../../shared/tools"
import { t } from "../../../i18n"

import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import { getTaskWithId } from "../../../features/history/actions"
import { reopenParentFromDelegation } from "../task/actions/delegateTask"
import { ask } from "../task/notifications/actions/ask"
import { agentBroadcast, systemBroadcast, userBroadcast } from "../task/messages/actions/say"
import { sayAndCreateMissingParamError } from "../task/messages/actions/missingParamError"
import { getBackendRootStore } from "@features/storeSingleton"

interface AttemptCompletionParams {
	result: string
	command?: string
}

export interface AttemptCompletionCallbacks extends ToolCallbacks {
	askFinishSubTaskApproval: () => Promise<boolean>
	toolDescription: () => string
}

/** Typed helper to access Task-only methods on an ITaskModel. */
function getTaskForCommit(
	task: ITaskModel,
): ITaskModel & { commitChanges: () => Promise<void>; emitFinalTokenUsageUpdate: () => void } {
	return task as ITaskModel & { commitChanges: () => Promise<void>; emitFinalTokenUsageUpdate: () => void }
}

import type { ProviderHandle } from "@features/foundation/webview/EventBridge"

export class AttemptCompletionTool extends BaseTool<"attempt_completion"> {
	readonly name = "attempt_completion" as const

	async execute(
		params: AttemptCompletionParams,
		task: ITaskModel,
		callbacks: AttemptCompletionCallbacks,
	): Promise<void> {
		const { result } = params
		const { handleError, pushToolResult, askFinishSubTaskApproval } = callbacks

		// Prevent attempt_completion if any tool failed in the current turn
		if (task._state.didToolFailInCurrentTurn) {
			const errorMsg = t("common:errors.attempt_completion_tool_failed")

			await systemBroadcast(task.taskId, "error", errorMsg)
			pushToolResult(formatResponse.toolError(errorMsg))
			return
		}

		const preventCompletionWithOpenTodos = vscode.workspace
			.getConfiguration(Package.name)
			.get<boolean>("preventCompletionWithOpenTodos", false)

		const hasIncompleteTodos =
			task._state.todoList && task._state.todoList.some((todo) => todo.status !== "completed")

		if (preventCompletionWithOpenTodos && hasIncompleteTodos) {
			task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
			task.recordToolError("attempt_completion")

			pushToolResult(
				formatResponse.toolError(
					"Cannot complete task while there are incomplete todos. Please finish all todos before attempting completion.",
				),
			)

			return
		}

		try {
			if (!result) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("attempt_completion")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "attempt_completion", "result"))
				return
			}

			task._state.setCompletionResultSummary(result) // Jabberwock: store result for await_batch_completion
			task._state.setIsCompleted(true) // Jabberwock: mark as completed
			// Signal ChatStore-level completion
			getBackendRootStore().chat.setIsCompleted(true)
			// Create cleanup intent: task.completion.requested handler owns unregisterTask + state push
			getBackendRootStore().intentStore.createIntent({
				id: crypto.randomUUID(),
				type: IntentType.TaskCompletionRequested,
				payload: { taskId: task.taskId },
				status: IntentStatus.Queued,
				createdAt: Date.now(),
			})

			task._state.setConsecutiveMistakeCount(0)

			// Check if task was aborted before attempting to say completion_result
			if (task._state.abort) {
				console.log(
					`[AttemptCompletionTool] Task ${task.taskId} was aborted before completion_result could be displayed. Pushing abort result.`,
				)
				pushToolResult(formatResponse.toolResult("Task was aborted."))
				return
			}

			await agentBroadcast(task.taskId, "completion_result", result, undefined, false)

			// Check for subtask using parentTaskId (metadata-driven delegation)
			if (task.parentTaskId) {
				// Check if this subtask has already completed and returned to parent
				// to prevent duplicate tool_results when user revisits from history
				const provider = task.providerRef!.deref()
				if (provider) {
					try {
						const { historyItem } = await getTaskWithId(provider, task.taskId)
						const status = historyItem?.status

						if (status === "completed") {
							// Subtask already completed - skip delegation flow entirely
							// Fall through to normal completion ask flow below (outside this if block)
							// This shows the user the completion result and waits for acceptance
							// without injecting another tool_result to the parent
						} else if (status === "active") {
							// Normal subtask completion - do delegation
							const delegation = await this.delegateToParent(
								task,
								result,
								provider,
								askFinishSubTaskApproval,
								pushToolResult,
							)
							if (delegation === "delegated") {
								this.emitTaskCompleted(task)
							}
							if (delegation !== "continue") return
						} else {
							// Unexpected status (undefined or "delegated") - log error and skip delegation
							// undefined indicates a bug in status persistence during child creation
							// "delegated" would mean this child has its own grandchild pending (shouldn't reach attempt_completion)
							console.error(
								`[jabberwock] [AttemptCompletionTool] Unexpected child task status "${status}" for task ${task.taskId}. ` +
									`Expected "active" or "completed". Skipping delegation to prevent data corruption.`,
							)
							// Fall through to normal completion ask flow
						}
					} catch (err) {
						// If we can't get the history, log error and skip delegation
						console.error(
							`[jabberwock] [AttemptCompletionTool] Failed to get history for task ${task.taskId}: ${(err as Error)?.message ?? String(err)}. ` +
								`Skipping delegation.`,
						)
						// Fall through to normal completion ask flow
					}
				}
			}

			const { response, text, images } = await ask(task.taskId, "completion_result", "", false)

			if (response === "yesButtonClicked") {
				try {
					await getTaskForCommit(task).commitChanges()
				} catch (error) {
					const commitErrorMsg = `Failed to commit changes to disk: ${error instanceof Error ? error.message : String(error)}`
					await systemBroadcast(task.taskId, "error", commitErrorMsg)
					// Push error to tool result so agent can try to handle it (e.g. fix permissions)
					pushToolResult(formatResponse.toolError(commitErrorMsg))
					return
				}
				this.emitTaskCompleted(task)
				return
			}

			// User provided feedback - push tool result to continue the conversation
			await userBroadcast(task.taskId, "user_feedback", text ?? "", images)

			const feedbackText = `<user_message>\n${text}\n</user_message>`
			pushToolResult(formatResponse.toolResult(feedbackText, images))
		} catch (error) {
			await handleError("inspecting site", error as Error)
		}
	}

	/**
	 * Handles the common delegation flow when a subtask completes.
	 * Returns:
	 * - "delegated" when completion was approved and parent resumed
	 * - "denied" when user denied finishing the subtask
	 * - "continue" when caller should fall through to normal completion ask flow
	 */
	private async delegateToParent(
		task: ITaskModel,
		result: string,
		provider: ProviderHandle,
		askFinishSubTaskApproval: () => Promise<boolean>,
		pushToolResult: (result: string) => void,
	): Promise<"delegated" | "denied" | "continue"> {
		const didApprove = await askFinishSubTaskApproval()

		if (!didApprove) {
			pushToolResult(formatResponse.toolDenied())
			return "denied"
		}

		pushToolResult("")

		await reopenParentFromDelegation(provider, {
			parentTaskId: task.parentTaskId!,
			childTaskId: task.taskId,
			completionResultSummary: result,
		})

		return "delegated"
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
		// Force final token usage update before emitting TaskCompleted.
		// This ensures the latest stats are captured regardless of throttle timer.
		getTaskForCommit(task).emitFinalTokenUsageUpdate()

		getTelemetryService().captureTaskCompleted(task.taskId)
		task.emit!(JabberwockEventName.TaskCompleted, task.taskId, task.tokenUsage!, task._state.toolUsage)
	}
}

export const attemptCompletionTool = new AttemptCompletionTool()
