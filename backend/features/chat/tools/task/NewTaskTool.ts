import type { ITaskModel } from "@features/chat/task"
import { getModeBySlug, getAllModes } from "@shared/modes"
import { formatResponse } from "@features/settings"
import { parseMarkdownChecklist } from "@features/chat"
import { createTool, ToolCallbacks, ToolParams } from "@features/chat/tools/tool"
import type { ToolUse } from "@shared/tools"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { emitBroadcast } from "@features/chat/task/messages/actions/say"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

export const newTaskTool = createTool<"new_task">({
	name: "new_task" as const,

	async execute(params: ToolParams<"new_task">, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { mode, message, todos, is_async } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			if (!message) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("new_task")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "new_task", "message"))
				return
			}

			task._state.setConsecutiveMistakeCount(0)

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

			await emitBroadcast(
				"user",
				task.taskId,
				"subtask_result",
				`Starting new task in ${targetMode.name ?? mode} mode: ${message}`,
			)
			pushToolResult(formatResponse.toolResult(`New task created in ${mode} mode.`))
		} catch (error) {
			await handleError("creating new task", error instanceof Error ? error : new Error(String(error)))
		}
	},

	async handlePartial(task: ITaskModel, block: ToolUse<"new_task">): Promise<void> {
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

		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})
	},
})
