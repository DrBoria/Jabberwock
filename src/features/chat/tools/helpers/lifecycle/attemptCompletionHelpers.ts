import * as vscode from "vscode"

import { formatResponse } from "@features/settings/context/responses"
import { Package } from "@shared/package"
import { t } from "@i18n"

import type { ITaskModel } from "@features/chat/task/store"
import { getTaskWithId } from "@features/hist/actions"
import { reopenParentFromDelegation } from "@features/chat/task/actions/delegateTask"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

// ── Pre-condition validation ──────────────────────────────────────────────────

export async function validateAttemptCompletionPreConditions(
	task: ITaskModel,
	result: string | undefined,
	_pushToolResult: (content: string) => void,
): Promise<string | null> {
	if (task._state.didToolFailInCurrentTurn) {
		const errorMsg = t("common:errors.attempt_completion_tool_failed")
		return errorMsg
	}
	const preventCompletionWithOpenTodos = vscode.workspace
		.getConfiguration(Package.name)
		.get<boolean>("preventCompletionWithOpenTodos", false)
	const hasIncompleteTodos = task._state.todoList && task._state.todoList.some((todo) => todo.status !== "completed")
	if (preventCompletionWithOpenTodos && hasIncompleteTodos) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("attempt_completion")
		return "Cannot complete task while there are incomplete todos. Please finish all todos before attempting completion."
	}
	if (!result) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("attempt_completion")
		return await sayAndCreateMissingParamError(task.taskId, "attempt_completion", "result")
	}
	return null
}

// ── Subtask delegation ────────────────────────────────────────────────────────

/**
 * Handles the subtask delegation flow when a task has a parentTaskId.
 * Returns true if the caller should return early (stop execution),
 * false if it should continue to the normal completion ask flow.
 */
export async function resolveSubtaskDelegation(
	task: ITaskModel,
	result: string,
	askFinishSubTaskApproval: () => Promise<boolean>,
	pushToolResult: (result: string) => void,
	emitTaskCompleted: () => void,
): Promise<boolean> {
	try {
		const { historyItem } = await getTaskWithId(task.taskId)
		const status = historyItem?.status
		if (status === "completed") {
			return false
		}
		if (status === "active") {
			const delegation = await delegateToParent(task, result, askFinishSubTaskApproval, pushToolResult)
			if (delegation === "delegated") {
				emitTaskCompleted()
			}
			return delegation !== "continue"
		}
		console.error(
			`[jabberwock] [AttemptCompletionTool] Unexpected child task status "${status}" for task ${task.taskId}. ` +
				`Expected "active" or "completed". Skipping delegation to prevent data corruption.`,
		)
		return false
	} catch (err) {
		console.error(
			`[jabberwock] [AttemptCompletionTool] Failed to get history for task ${task.taskId}: ${(err as Error)?.message ?? String(err)}. ` +
				`Skipping delegation.`,
		)
		return false
	}
}

async function delegateToParent(
	task: ITaskModel,
	result: string,
	askFinishSubTaskApproval: () => Promise<boolean>,
	pushToolResult: (result: string) => void,
): Promise<"delegated" | "denied" | "continue"> {
	const didApprove = await askFinishSubTaskApproval()
	if (!didApprove) {
		pushToolResult(formatResponse.toolDenied())
		return "denied"
	}
	pushToolResult("")
	await reopenParentFromDelegation({
		parentTaskId: task.parentTaskId!,
		childTaskId: task.taskId,
		completionResultSummary: result,
	})
	return "delegated"
}
