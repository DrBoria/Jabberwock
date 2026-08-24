import type { ITaskModel } from "@features/chat/task/store"
import { type ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"
import { overwriteApiConversationHistory } from "@features/chat/task/messages/actions/save/saveApiMessages"
import { Anthropic } from "@anthropic-ai/sdk"

function stringEquals(a: string, b: string): boolean {
	return a === b
}

export async function rewriteHistoryAfterPlanApproval(
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
