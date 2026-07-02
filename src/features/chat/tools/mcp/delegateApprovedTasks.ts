import type { ITaskModel } from "@features/chat/task/store"
import { startBackgroundTask } from "@features/chat/task/actions/startTask"
import { delegateParentAndOpenChild } from "@features/chat/task/actions/delegateTask"
import { diagnosticsManager } from "@jabberwock/devtool"

function todoLog(msg: string, data?: { [key: string]: unknown }) {
	const logMsg = `[TODO-LOG] [UseMcpToolTool] ${msg}${data ? " " + JSON.stringify(data) : ""}`
	console.log(logMsg)
	try {
		diagnosticsManager.log(logMsg, "info")
	} catch {}
}

export { todoLog }

export async function delegateApprovedTasks(
	task: ITaskModel,
	approvedTasks: { id: string; title: string; description?: string; assignedTo: string; isAsync?: boolean }[],
): Promise<{ delegationResults: string[]; isDelegated: boolean }> {
	const delegationResults: string[] = []
	let isDelegated = false

	for (const todoTask of approvedTasks) {
		const delegationMessage = `[CRITICAL - USER APPROVED PLAN]\n\nYou are executing a task from a user-approved master plan. The user interactively reviewed and finalized this plan.\n\nYOUR INSTRUCTIONS:\n1. Execute ONLY the task described below\n2. DO NOT create additional tasks or subtasks\n3. DO NOT re-plan or modify the scope\n4. Complete this specific task and report back\n\nTASK TO EXECUTE:\n${todoTask.title}\n${todoTask.description ? `\nDESCRIPTION:\n${todoTask.description}` : ""}\n\nRemember: This is an execution-only assignment from an approved plan.`

		todoLog("delegating task", {
			taskId: todoTask.id,
			assignedTo: todoTask.assignedTo,
			title: todoTask.title,
			isAsync: todoTask.isAsync,
		})

		try {
			if (todoTask.isAsync) {
				const child = await startBackgroundTask({
					parentTaskId: task.taskId,
					message: delegationMessage,
					initialTodos: [],
					mode: todoTask.assignedTo,
				})

				const todoItem = task._state.todoList?.find((todo) => todo.id === todoTask.id)
				if (todoItem) {
					todoItem.taskId = child.taskId
				}

				delegationResults.push(`✓ ${todoTask.id} → ${todoTask.assignedTo} (async, child: ${child.taskId})`)
			} else {
				const child = await delegateParentAndOpenChild({
					parentTaskId: task.taskId,
					message: delegationMessage,
					initialTodos: [],
					mode: todoTask.assignedTo,
				})

				const todoItem = task._state.todoList?.find((todo) => todo.id === todoTask.id)
				if (todoItem) {
					todoItem.taskId = child.taskId
				}

				delegationResults.push(`✓ ${todoTask.id} → ${todoTask.assignedTo} (sync, child: ${child.taskId})`)
				isDelegated = true
				break
			}
		} catch (delegationError) {
			const errMsg = delegationError instanceof Error ? delegationError.message : String(delegationError)
			console.error(`[jabberwock] [DeterministicDelegation] Failed to delegate ${todoTask.id}: ${errMsg}`)
			delegationResults.push(`✗ ${todoTask.id} → ${todoTask.assignedTo} FAILED: ${errMsg}`)
		}
	}

	return { delegationResults, isDelegated }
}
