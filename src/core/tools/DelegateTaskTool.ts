import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { getModeBySlug } from "../../shared/modes"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface DelegateTaskParams {
	task_id: string
	target_role: string
	message: string
	is_async?: boolean
}

export class DelegateTaskTool extends BaseTool<"delegate_task"> {
	readonly name = "delegate_task" as const

	async execute(params, task, callbacks) {
		const { task_id, target_role, message, is_async } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			// Phase 1: Deterministic Routing Hook
			if (!task_id || !target_role || !message) {
				const missing = !task_id ? "task_id" : !target_role ? "target_role" : "message"
				task.consecutiveMistakeCount++
				task.recordToolError("delegate_task")
				pushToolResult(await task.sayAndCreateMissingParamError("delegate_task", missing))
				return { isDelegated: false }
			}

			// Prevent redundant delegation of native tools
			const extractedTool = this.extractToolName(message)
			const provider = task.providerRef.deref()
			let state = provider ? await provider.getState() : undefined
			const currentAgent = state?.mode && provider ? (provider as any).getAgentProfile?.(state.mode) : undefined

			if (extractedTool && currentAgent && currentAgent.canUseTool(extractedTool)) {
				task.recordToolError("delegate_task")
				pushToolResult(
					formatResponse.toolError(
						`Redundant delegation blocked: You already have permission to use the "${extractedTool}" tool natively. Please execute it directly instead of delegating to another agent.`,
					),
				)
				return { isDelegated: false }
			}

			// Validate against TODO plan
			const todoList = task.todoList || []
			const todoItem = todoList.find((item) => item.id === task_id)

			if (!todoItem) {
				task.recordToolError("delegate_task")
				task.didToolFailInCurrentTurn = true
				pushToolResult(
					formatResponse.toolError(
						`Invalid task_id: "${task_id}". Please ensure you are using a task ID from the approved TODO plan.`,
					),
				)
				return { isDelegated: false }
			}

			if (todoItem.assignedTo !== target_role) {
				task.recordToolError("delegate_task")
				task.didToolFailInCurrentTurn = true
				pushToolResult(
					formatResponse.toolError(
						`Authorization failed: Task "${task_id}" is assigned to "${todoItem.assignedTo}" in the approved plan, but you attempted to delegate it to "${target_role}". Deterministic routing requires strict adherence to the human-approved plan.`,
					),
				)
				return { isDelegated: false }
			}

			// Phase 2: Execution logic (forked from NewTaskTool)
			if (!provider) {
				pushToolResult(formatResponse.toolError("Provider reference lost"))
				return { isDelegated: false }
			}

			state = await provider.getState()
			const targetMode = getModeBySlug(target_role, state?.customModes)

			if (!targetMode) {
				pushToolResult(formatResponse.toolError(`Invalid role: ${target_role}`))
				return { isDelegated: false }
			}

			task.consecutiveMistakeCount = 0

			const toolMessage = JSON.stringify({
				tool: "delegateTask",
				task_id,
				role: targetMode.name,
				content: message,
				is_async,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return { isDelegated: false }
			}

			const unescapedMessage = message.replace(/\\\\\\\\@/g, "\\@")

			// 5) Enhance message with parent context
			const contextHeader = `[PARENT CONTEXT] You are a subtask delegated from parent task ${task.taskId}.
Relationship: This agent is executing one step of a broader plan.
Parent Objective: ${task.metadata.task}

Objective for this subtask:
${unescapedMessage}`

			if (is_async) {
				const child = await provider.startBackgroundTask({
					parentTaskId: task.taskId,
					message: contextHeader,
					initialTodos: [], // Subtasks share the context but start fresh
					mode: target_role,
				})
				pushToolResult(
					`Started async background task ${child.taskId} for TODO item "${task_id}". You can await its completion later.`,
				)
				return { isDelegated: true }
			}

			const child = await provider.delegateParentAndOpenChild({
				parentTaskId: task.taskId,
				message: contextHeader,
				initialTodos: [],
				mode: target_role,
			})

			pushToolResult(`Delegated TODO item "${task_id}" to child task ${child.taskId} (agent: ${target_role})`)
			return { isDelegated: true }
		} catch (error) {
			await handleError("delegating task", error as Error)
			return { isDelegated: false }
		}
	}

	/**
	 * Extracts a tool name from a delegation message if one is present.
	 * This helps identify redundant delegations.
	 */
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
