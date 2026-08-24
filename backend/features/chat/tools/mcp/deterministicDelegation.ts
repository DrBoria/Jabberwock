import type { ITaskModel } from "@features/chat/task/store"

import { delegateApprovedTasks, todoLog } from "./delegateApprovedTasks"
import { rewriteHistoryAfterPlanApproval } from "./rewriteHistoryAfterPlanApproval"

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

	const { delegationResults, isDelegated } = await delegateApprovedTasks(task, approvedTasks)

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
