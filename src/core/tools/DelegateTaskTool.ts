import { Task } from "../../features/chat/task/Task"
import { formatResponse } from "../prompts/responses"
import { getModeBySlug, getAllModes } from "../../shared/modes"
import { BaseTool, ToolCallbacks, ToolParams } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface DelegateTaskParams {
	task_id: string
	target_role: string
	message: string
	is_async?: boolean
}

export class DelegateTaskTool extends BaseTool<"delegate_task"> {
	readonly name = "delegate_task" as const

	async execute(params: ToolParams<"delegate_task">, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { task_id, target_role, message, is_async } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			if (!target_role || !message) {
				task.consecutiveMistakeCount++
				task.recordToolError("delegate_task")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("delegate_task", "message"))
				return
			}

			task.consecutiveMistakeCount = 0

			const targetMode = getModeBySlug(target_role)
			if (!targetMode) {
				pushToolResult(
					formatResponse.toolError(
						`Invalid target role: ${target_role}. Available modes: ${getAllModes()
							.map((m) => m.slug)
							.join(", ")}`,
					),
				)
				return
			}

			const toolMessage = JSON.stringify({
				tool: "delegateTask",
				task_id: task_id ?? "",
				role: target_role,
				content: message,
				is_async: is_async ?? false,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			await task.say("subtask_result", `Delegating to ${target_role}: ${message}`)
			pushToolResult(formatResponse.toolResult(`Task delegated to ${target_role}. Task ID: ${task_id ?? "N/A"}`))
		} catch (error) {
			await handleError("delegating task", error instanceof Error ? error : new Error(String(error)))
		}
	}

	private extractToolName(message: string): string | undefined {
		// Match patterns like "execute_command tool", "use the read_file tool", etc.
		const match = message.match(/['"]?(\w+)['"]?\s+tool/i)
		return match ? match[1] : undefined
	}

	override async handlePartial(task: Task, block: ToolUse<"delegate_task">): Promise<void> {
		const { task_id, target_role, message, is_async } = block.params

		const partialMessage = JSON.stringify({
			tool: "delegateTask",
			task_id: task_id ?? "",
			role: target_role ?? "",
			content: message ?? "",
			is_async: is_async === "true",
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const delegateTaskTool = new DelegateTaskTool()
