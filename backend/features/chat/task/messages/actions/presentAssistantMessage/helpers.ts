import { serializeError } from "serialize-error"
import { Anthropic } from "@anthropic-ai/sdk"

import type { NotificationAsk, ToolProgressStatus } from "@jabberwock/types"
import { TelemetryEventName } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { customToolRegistry } from "@jabberwock/core"

import type { ToolResponse, ToolUse } from "@shared/tools"

import type { ITaskModel } from "@features/chat/task/store"

import { AskIgnoredError } from "@features/chat/task/notifications/actions"
import { systemBroadcast, userBroadcast } from "@features/chat/task/messages/actions/say"

import { pushToolResultToUserContent } from "@features/api/handlers/helpers/process/streaming"
import { formatResponse } from "@features/settings/context/responses"
import { sanitizeToolUseId } from "@utils/mcp"
import { getBackendRootStore } from "@features/storeSingleton"
import { delegateParentAndOpenChild } from "@features/chat/task/actions/delegateTask"

import { ask } from "@features/chat/task/notifications/actions/ask"

function createAskApproval(
	task: ITaskModel,
	pushResult: (content: ToolResponse, feedbackImages?: string[]) => void,
): (
	type: NotificationAsk,
	partialMessage?: string,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
) => Promise<boolean> {
	return async (type, partialMessage, progressStatus, isProtected) => {
		const { response, text, images } = await ask(
			task.taskId,
			type,
			partialMessage,
			false,
			progressStatus,
			isProtected || false,
		)

		if (response !== "yesButtonClicked") {
			if (text) {
				await userBroadcast(task.taskId, "user_feedback", text, images)
				pushResult(formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images))
			} else {
				pushResult(formatResponse.toolDenied())
			}
			task._state.setDidRejectTool(true)
			return false
		}

		if (text) {
			await userBroadcast(task.taskId, "user_feedback", text, images)
		}

		return true
	}
}

async function handleToolError(
	task: ITaskModel,
	action: string,
	error: Error,
	pushResult: (content: ToolResponse) => void,
	blockName: string,
): Promise<void> {
	if (error instanceof AskIgnoredError) {
		return
	}

	if (task._state.abort || task.currentRequestAbortController?.signal.aborted || error.message?.includes("aborted")) {
		return
	}

	const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`

	await systemBroadcast(
		task.taskId,
		"error",
		`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
	)

	pushResult(formatResponse.toolError(errorString))
	try {
		getBackendRootStore().chat.toolCallError(blockName, errorString)
	} catch {
		// Silently ignore - store may not be initialized yet
	}
}

function createHandleError(
	task: ITaskModel,
	pushResult: (content: ToolResponse) => void,
	blockName?: string,
): (action: string, error: Error) => Promise<void> {
	return async (action, error) => {
		await handleToolError(task, action, error, pushResult, blockName ?? "unknown")
	}
}

async function handleOrchestratorDelegation(
	task: ITaskModel,
	block: ToolUse,
	pushResult: (content: ToolResponse) => void,
): Promise<boolean> {
	const message = `I am delegating the execution of the '${block.name}' tool to you.\nParams: ${JSON.stringify(block.params, null, 2)}\nPlease execute this tool and confirm once done.`

	task.toolRepetitionDetector!.reset()
	task._state.setConsecutiveMistakeCount(0)

	pushResult(
		`[Auto-Delegation] Intercepted '${block.name}' call. Spawning a 'Coder' sub-agent branch to perform this action.`,
	)

	void delegateParentAndOpenChild({
		parentTaskId: task.taskId,
		message,
		mode: "coder",
	})
	return true
}

interface ToolResultState {
	hasToolResult: boolean
	approvalFeedback?: { text: string; images?: string[] }
}

function handleToolResult(
	task: ITaskModel,
	toolCallId: string,
	content: ToolResponse,
	blockName: string,
	state: ToolResultState,
): void {
	if (state.hasToolResult) {
		return
	}

	let resultContent: string
	let imageBlocks: Anthropic.ImageBlockParam[] = []

	if (typeof content === "string") {
		resultContent = content || "(tool did not return anything)"
	} else {
		const textBlocks = content.filter((item) => item.type === "text")
		imageBlocks = content.filter((item) => item.type === "image") as Anthropic.ImageBlockParam[]
		resultContent =
			textBlocks.map((item) => (item as Anthropic.TextBlockParam).text).join("\n") ||
			"(tool did not return anything)"
	}

	if (state.approvalFeedback) {
		const feedbackText = formatResponse.toolApprovedWithFeedback(state.approvalFeedback.text)
		resultContent = `${feedbackText}\n\n${resultContent}`
		if (state.approvalFeedback.images) {
			const feedbackImageBlocks = formatResponse.imageBlocks(state.approvalFeedback.images)
			imageBlocks = [...feedbackImageBlocks, ...imageBlocks]
		}
	}

	pushToolResultToUserContent(task.userMessageContent, {
		type: "tool_result",
		tool_use_id: sanitizeToolUseId(toolCallId),
		content: resultContent,
	})

	if (imageBlocks.length > 0) {
		task.userMessageContent.push(...imageBlocks)
	}

	state.hasToolResult = true
	try {
		getBackendRootStore().chat.toolCallCompleted(blockName, resultContent)
	} catch {
		// Silently ignore - store may not be initialized yet
	}
}

async function recordToolUsageForBlock(
	task: ITaskModel,
	block: ToolUse,
	stateExperiments: Record<string, unknown>,
): Promise<void> {
	const isCustomTool = stateExperiments?.customTools && customToolRegistry.has(block.name)
	const recordName = isCustomTool ? "custom_tool" : block.name
	try {
		task.recordToolUsage(recordName)
	} catch (metricsError) {
		console.error(`[jabberwock] [metrics] Failed to record tool usage for '${recordName}':`, metricsError)
	}
	getTelemetryService().captureToolUsage(task.taskId, recordName)

	if (block.name === "read_file" && block.usedLegacyFormat) {
		const modelInfo = task.api!.getModel()
		getTelemetryService().captureEvent(TelemetryEventName.READ_FILE_LEGACY_FORMAT_USED, {
			taskId: task.taskId,
			model: modelInfo?.id,
		})
	}
}

export type { ToolResultState }
export {
	createAskApproval,
	handleToolError,
	createHandleError,
	handleOrchestratorDelegation,
	handleToolResult,
	recordToolUsageForBlock,
}
