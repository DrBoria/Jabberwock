import type { ITaskModel } from "@features/chat/task/store"
import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import type { ToolUse } from "@shared/tools"

import { TodoItem } from "@jabberwock/types"
import { ask } from "@features/chat/task/notifications/actions/ask"

import {
	parseAndValidateTodos,
	isTodoListChanged,
	broadcastTodoEdit,
	buildTodoResultMessage,
	setTodoListForTask,
	setApprovedTodoList,
	parseMarkdownChecklist,
	addTodoToTask,
	updateTodoStatusForTask,
	removeTodoFromTask,
	getTodoListForTask,
	restoreTodoListForTask,
	setPendingTodoList,
} from "@features/chat/tools/helpers/lifecycle"

export {
	parseMarkdownChecklist,
	addTodoToTask,
	updateTodoStatusForTask,
	removeTodoFromTask,
	getTodoListForTask,
	restoreTodoListForTask,
	setPendingTodoList,
}

interface UpdateTodoListParams {
	todos: string
}

export class UpdateTodoListTool extends BaseTool<"update_todo_list"> {
	readonly name = "update_todo_list" as const

	async execute(params: UpdateTodoListParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError, askApproval } = callbacks

		try {
			const parsed = await parseAndValidateTodos(params.todos, task, pushToolResult)
			if (!parsed) {
				return
			}

			let { normalizedTodos } = parsed

			const approvalMsg = JSON.stringify({
				tool: "updateTodoList",
				todos: normalizedTodos,
			})

			setApprovedTodoList(normalizedTodos)
			const didApprove = await askApproval("tool", approvalMsg)
			if (!didApprove) {
				pushToolResult("User declined to update the todoList.")
				return
			}

			const { changed, userEdited } = isTodoListChanged(normalizedTodos)
			if (changed && userEdited) {
				normalizedTodos = userEdited
				broadcastTodoEdit(task, normalizedTodos)
			}

			await setTodoListForTask(task, normalizedTodos)
			pushToolResult(buildTodoResultMessage(changed, normalizedTodos))
		} catch (error) {
			await handleError("update todo list", error as Error)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"update_todo_list">): Promise<void> {
		const todosRaw = block.params.todos

		let todos: TodoItem[]
		try {
			todos = parseMarkdownChecklist(todosRaw || "")
		} catch {
			todos = []
		}

		const approvalMsg = JSON.stringify({
			tool: "updateTodoList",
			todos: todos,
		})
		await ask(task.taskId, "tool", approvalMsg, block.partial).catch(() => {})
	}
}

export const updateTodoListTool = new UpdateTodoListTool()
