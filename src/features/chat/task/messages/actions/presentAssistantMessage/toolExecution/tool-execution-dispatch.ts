import { customToolRegistry } from "@jabberwock/core"
import type { CustomToolDefinition, ToolName } from "@jabberwock/types"
import { t } from "@i18n"
import { defaultModeSlug } from "@shared/modes"
import type { ToolResponse, ToolUse } from "@shared/tools"
import type { ToolExecutionCallbacks } from "./tool-execution-types"
import type { ITaskModel } from "@features/chat/task/store"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { pushToolResultToUserContent } from "@features/api/handlers/helpers/process/streaming"
import { formatResponse } from "@features/settings/context/responses"
import { sanitizeToolUseId } from "@utils/mcp"
import { checkpointSave } from "@features/foundation/time-machine/actions/checkpoints"
import { attemptCompletionTool, type AttemptCompletionCallbacks } from "@features/chat/tools"
import { newTaskTool } from "@features/chat/tools"
import {
	TOOL_HANDLER_MAP,
	createToolDescription,
} from "@features/chat/task/messages/actions/presentAssistantMessage/dispatchMaps"

async function checkpointSaveAndMark(task: ITaskModel): Promise<void> {
	if (task._state.currentStreamingDidCheckpoint) {
		return
	}
	try {
		await checkpointSave(task, true)
		task._state.setCurrentStreamingDidCheckpoint(true)
	} catch (error) {
		const checkpointError = error instanceof Error ? error.message : String(error)
		console.error(`[jabberwock] [Task#presentAssistantMessage] Error saving checkpoint: ${checkpointError}`, error)
	}
}

export async function dispatchToolExecution(
	task: ITaskModel,
	block: ToolUse,
	callbacks: ToolExecutionCallbacks,
): Promise<void> {
	const { askApproval, handleError, pushToolResult } = callbacks
	const entry = TOOL_HANDLER_MAP[block.name]

	if (entry) {
		if (entry.needsCheckpoint) {
			await checkpointSaveAndMark(task)
		}

		if (block.name === "attempt_completion") {
			const completionCallbacks: AttemptCompletionCallbacks = {
				askApproval,
				handleError,
				pushToolResult,
				askFinishSubTaskApproval: async () => {
					const toolMessage = JSON.stringify({ tool: "finishTask" })
					return await askApproval("tool", toolMessage)
				},
				toolDescription: () => createToolDescription(block),
			}
			await attemptCompletionTool.handle(task, block as ToolUse<"attempt_completion">, completionCallbacks)
			return
		}

		if (block.name === "new_task") {
			await newTaskTool.handle(task, block as ToolUse<"new_task">, {
				...callbacks,
				toolCallId: block.id,
			})
			return
		}

		await entry.handler.handle(task, block as never, { askApproval, handleError, pushToolResult })
		return
	}

	if (block.partial) {
		return
	}

	const customTool = customToolRegistry.get(block.name)

	if (customTool) {
		await handleCustomToolExecution(task, block, customTool, pushToolResult, handleError)
		return
	}

	const errorMessage = `Unknown tool "${block.name}". This tool does not exist. Please use one of the available tools.`
	task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
	task.recordToolError(block.name as ToolName, errorMessage)
	await systemBroadcast(task.taskId, "error", t("tools:unknownToolError", { toolName: block.name }))
	pushToolResultToUserContent(task.userMessageContent, {
		type: "tool_result",
		tool_use_id: sanitizeToolUseId(block.id ?? ""),
		content: formatResponse.toolError(errorMessage),
		is_error: true,
	})
}

export async function handleCustomToolExecution(
	task: ITaskModel,
	block: ToolUse,
	customTool: CustomToolDefinition,
	pushResult: (content: ToolResponse) => void,
	handleError: (action: string, error: Error) => Promise<void>,
): Promise<void> {
	try {
		let customToolArgs: { [key: string]: unknown } = {}

		if (customTool.parameters) {
			try {
				customToolArgs = customTool.parameters.parse(block.nativeArgs || block.params || {}) as {
					[key: string]: unknown
				}
			} catch (parseParamsError) {
				const parseError =
					parseParamsError instanceof Error ? parseParamsError.message : String(parseParamsError)
				const message = `Custom tool "${block.name}" argument validation failed: ${parseError}`
				console.error(message)
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				await systemBroadcast(task.taskId, "error", message)
				pushResult(formatResponse.toolError(message))
				return
			}
		}

		const executionResult = await customTool.execute(customToolArgs, {
			mode: task.taskMode ?? defaultModeSlug,
			task: task as ITaskModel & import("@jabberwock/types").TaskLike,
		})

		console.log(
			`${customTool.name}.execute(): ${JSON.stringify(customToolArgs)} -> ${JSON.stringify(executionResult)}`,
		)

		pushResult(executionResult)
		task._state.setConsecutiveMistakeCount(0)
	} catch (executionError: unknown) {
		const msg = executionError instanceof Error ? executionError.message : String(executionError)
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("custom_tool", msg)
		await handleError(
			`executing custom tool "${block.name}"`,
			executionError instanceof Error ? executionError : new Error(msg),
		)
	}
}
