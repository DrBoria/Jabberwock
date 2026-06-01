import type { ITaskModel } from "../../task/store"
import { type ApiMessage } from "../../task/messages/actions/saveApiConversation"
import { delegateParentAndOpenChild } from "../../task/actions/delegateTask"
import { startBackgroundTask } from "../../task/actions/startTask"
import { overwriteApiConversationHistory } from "../../task/messages/actions/saveApiConversation"
import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Logs a todo lifecycle event for debugging purposes.
 */

import { diagnosticsManager } from "@jabberwock/devtool"

function todoLog(msg: string, data?: { [key: string]: unknown }) {
	const logMsg = `[TODO-LOG] [UseMcpToolTool] ${msg}${data ? " " + JSON.stringify(data) : ""}`
	console.log(logMsg)
	try {
		diagnosticsManager.log(logMsg, "info")
	} catch {}
}

/**
 * Result of deterministic delegation processing.
 */
export interface DelegationResult {
	/** Whether any sync delegation occurred (parent was aborted) */
	isDelegated: boolean
	/** Human-readable summary of delegation results */
	summary: string
	/** The tool result text to return */
	toolResultPretty: string
}

/**
 * Processes the approved plan from manage_todo_plan and programmatically creates subtasks.
 *
 * This bypasses the LLM for task creation, using the user-approved plan directly.
 * Supports both sync delegation (delegateParentAndOpenChild - blocking, aborts parent)
 * and async delegation (startBackgroundTask - non-blocking, parent continues).
 *
 * After delegation, rewrites API conversation history to eliminate traces of the
 * original mutation conversation, so the LLM only sees the approved plan.
 *
 * @returns DelegationResult with delegation status and summary, or null if the plan
 *          was cancelled (all tasks removed by user).
 */
/**
 * Runtime validator for approved task items from plan JSON.
 */
function isApprovedTasksArray(
	value: unknown,
): value is { id: string; title: string; description?: string; assignedTo: string; isAsync?: boolean }[] {
	if (!Array.isArray(value)) {
		return false
	}
	return value.every(
		(item): item is { id: string; title: string; description?: string; assignedTo: string; isAsync?: boolean } =>
			item !== null && typeof item === "object" && "id" in item && "title" in item && "assignedTo" in item,
	)
}

/**
 * Safe string comparison that avoids "types have no overlap" errors
 * when comparing a narrow union literal type against an unknown string value.
 */
function stringEquals(a: string, b: string): boolean {
	return a === b
}

export async function processDeterministicDelegation(task: ITaskModel, text: string): Promise<DelegationResult | null> {
	const newPlan = JSON.parse(text)
	const approvedTasks: {
		id: string
		title: string
		description?: string
		assignedTo: string
		isAsync?: boolean
	}[] = isApprovedTasksArray(newPlan.initialTasks || newPlan.tasks) ? newPlan.initialTasks || newPlan.tasks : []

	todoLog("manage_todo_plan result received", {
		approvedCount: approvedTasks.length,
		tasks: approvedTasks.map((t) => `${t.id}:${t.assignedTo}:${t.title}`),
	})

	if (approvedTasks.length === 0) {
		todoLog("all tasks deleted by user — plan cancelled")
		return null
	}

	task._state.setTodoList(
		approvedTasks.map((t) => ({
			id: t.id,
			content: `${t.title}${t.description ? ": " + t.description : ""}`,
			status: "pending" as const,
			assignedTo: t.assignedTo,
		})),
	)

	// Bypass LLM: programmatically create subtasks for each approved task
	const provider = task.providerRef!.deref()
	if (!provider) {
		console.error("[jabberwock] [DeterministicDelegation] Provider reference lost, cannot delegate")
		return {
			isDelegated: false,
			summary: "Provider reference lost, cannot delegate",
			toolResultPretty: "Error: Provider reference lost, cannot delegate",
		}
	}

	const delegationResults: string[] = []
	let isDelegated = false

	for (const todoTask of approvedTasks) {
		// Wrap task in EXECUTION ONLY directive to prevent child re-planning
		// CRITICAL: User has already reviewed and approved this exact plan via interactive UI
		const delegationMessage = `[CRITICAL - USER APPROVED PLAN]\n\nYou are executing a task from a user-approved master plan. The user interactively reviewed and finalized this plan.\n\nYOUR INSTRUCTIONS:\n1. Execute ONLY the task described below\n2. DO NOT create additional tasks or subtasks\n3. DO NOT re-plan or modify the scope\n4. Complete this specific task and report back\n\nTASK TO EXECUTE:\n${todoTask.title}\n${todoTask.description ? `\nDESCRIPTION:\n${todoTask.description}` : ""}\n\nRemember: This is an execution-only assignment from an approved plan.`

		todoLog("delegating task", {
			taskId: todoTask.id,
			assignedTo: todoTask.assignedTo,
			title: todoTask.title,
			isAsync: todoTask.isAsync,
		})

		try {
			if (todoTask.isAsync) {
				const child = await startBackgroundTask(provider, {
					parentTaskId: task.taskId,
					message: delegationMessage,
					initialTodos: [],
					mode: todoTask.assignedTo,
				})

				// Store the created subtask's ID in the local todoList
				const todoItem = task._state.todoList?.find((todo) => todo.id === todoTask.id)
				if (todoItem) {
					todoItem.taskId = child.taskId
				}

				delegationResults.push(`✓ ${todoTask.id} → ${todoTask.assignedTo} (async, child: ${child.taskId})`)
			} else {
				const child = await delegateParentAndOpenChild(provider, {
					parentTaskId: task.taskId,
					message: delegationMessage,
					initialTodos: [],
					mode: todoTask.assignedTo,
				})

				// Store the created subtask's ID in the local todoList
				const todoItem = task._state.todoList?.find((todo) => todo.id === todoTask.id)
				if (todoItem) {
					todoItem.taskId = child.taskId
				}

				delegationResults.push(`✓ ${todoTask.id} → ${todoTask.assignedTo} (sync, child: ${child.taskId})`)
				// delegateParentAndOpenChild is blocking
				console.log(`[DeterministicDelegation] Sync delegation complete for ${todoTask.id}.`)
				isDelegated = true
				break
			}
		} catch (delegationError) {
			const errMsg = delegationError instanceof Error ? delegationError.message : String(delegationError)
			console.error(`[jabberwock] [DeterministicDelegation] Failed to delegate ${todoTask.id}: ${errMsg}`)
			delegationResults.push(`✗ ${todoTask.id} → ${todoTask.assignedTo} FAILED: ${errMsg}`)
		}
	}

	const summary = delegationResults.join("\n")
	const toolResultPretty = `Plan approved. Deterministic delegation initiated:\n${summary}`

	todoLog("delegation complete", {
		results: delegationResults,
		isDelegated,
	})

	// History Hack: Rewrite history to eliminate traces of the original mutation conversation
	await rewriteHistoryAfterPlanApproval(task, approvedTasks)

	return {
		isDelegated,
		summary,
		toolResultPretty,
	}
}

/**
 * Rewrites API conversation history after plan approval to eliminate traces
 * of the original mutation conversation. The agent should ONLY see the
 * approved tasks as if they were always the plan.
 */
async function rewriteHistoryAfterPlanApproval(
	task: ITaskModel,
	approvedTasks: { id: string; title: string; description?: string; assignedTo: string }[],
): Promise<void> {
	const firstUserMsgIndex = task.apiConversationHistory.findIndex((m) => m.role === "user")
	const firstUserMsg = firstUserMsgIndex !== -1 ? task.apiConversationHistory[firstUserMsgIndex] : undefined

	const toolUseBlock = task.assistantMessageContent.find(
		(block) => block.type === "tool_use" && stringEquals(block.name, "mcp--md-todo-mcp--manage_todo_plan"),
	)
	const toolUseId =
		toolUseBlock !== undefined && toolUseBlock.type === "tool_use"
			? (toolUseBlock.id ?? "unknown-id")
			: "unknown-id"

	const environmentDetailsBlock = (Array.isArray(firstUserMsg?.content) ? firstUserMsg.content : []).find(
		(c): c is Anthropic.TextBlockParam => c.type === "text" && c.text.includes("<environment_details>"),
	)

	// CRITICAL: Do NOT include originalReasoning - it contains traces of deleted/modified tasks
	// The agent must ONLY see the approved tasks as if they were always the plan
	const synthesizedUserText = `I have reviewed and finalized the task execution plan. Execute these approved tasks in order:\n${approvedTasks
		.map(
			(t, idx) =>
				`${idx + 1}. [${t.assignedTo}] ${t.title}${t.description ? `\n   Description: ${t.description}` : ""}`,
		)
		.join("\n")}\n\nIMPORTANT: Execute ONLY these tasks in the order shown. Do not attempt any other actions.`

	const userMsg = {
		role: "user" as const,
		content: [
			{ type: "text" as const, text: synthesizedUserText },
			...(environmentDetailsBlock ? [environmentDetailsBlock] : []),
		],
		ts: firstUserMsg?.ts ?? Date.now(),
	}

	const assistantMsg = {
		role: "assistant" as const,
		content: [
			{
				type: "tool_use" as const,
				id: toolUseId,
				name: "mcp--md-todo-mcp--manage_todo_plan",
				input: { initialTasks: approvedTasks },
			},
		],
		ts: Date.now(),
	}

	const cleanHistory: ApiMessage[] = [userMsg, assistantMsg]
	await overwriteApiConversationHistory(task, cleanHistory)
	console.log("[HistoryRewrite] Successfully rebuilt clean history after plan approval.")
}
