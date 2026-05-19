import * as vscode from "vscode"

import { TodoItem } from "@jabberwock/types"

import { Task } from "../../features/chat/task/Task"
import { getModeBySlug, getAllModes } from "../../shared/modes"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { parseMarkdownChecklist } from "./UpdateTodoListTool"
import { Package } from "../../shared/package"
import { BaseTool, ToolCallbacks, ToolParams } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface NewTaskParams {
	mode: string
	message: string
	todos?: string
	is_async?: boolean // Jabberwock: async orchestration
}

export class NewTaskTool extends BaseTool<"new_task"> {
	readonly name = "new_task" as const

	async execute(params: ToolParams<"new_task">, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { mode, message, todos, is_async } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			if (!message) {
				task.consecutiveMistakeCount++
				task.recordToolError("new_task")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("new_task", "message"))
				return
			}

			task.consecutiveMistakeCount = 0

			const targetMode = getModeBySlug(mode)
			if (!targetMode) {
				pushToolResult(
					formatResponse.toolError(
						`Invalid mode: ${mode}. Available modes: ${getAllModes()
							.map((m) => m.slug)
							.join(", ")}`,
					),
				)
				return
			}

			const todoItems = todos ? parseMarkdownChecklist(todos) : undefined

			const toolMessage = JSON.stringify({
				tool: "newTask",
				mode: mode ?? "code",
				content: message,
				todos: todoItems,
				is_async,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			await task.say("subtask_result", `Starting new task in ${targetMode.name ?? mode} mode: ${message}`)
			pushToolResult(formatResponse.toolResult(`New task created in ${mode} mode.`))
		} catch (error) {
			await handleError("creating new task", error instanceof Error ? error : new Error(String(error)))
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"new_task">): Promise<void> {
		const mode: string | undefined = block.params.mode
		const message: string | undefined = block.params.message
		const todos: string | undefined = block.params.todos
		const is_async: boolean | undefined = block.params.is_async === "true" // Jabberwock

		const partialMessage = JSON.stringify({
			tool: "newTask",
			mode: mode ?? "",
			content: message ?? "",
			todos: todos,
			is_async,
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const newTaskTool = new NewTaskTool()
