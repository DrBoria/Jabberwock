import { serializeError } from "serialize-error"

import type { ToolName, NotificationAsk, ModeConfig } from "@jabberwock/types"
import { ConsecutiveMistakeError } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { t } from "@i18n"

import { defaultModeSlug } from "@shared/modes"
import type { ToolResponse, ToolUse } from "@shared/tools"

import type { ITaskModel } from "@features/chat/task/store"

import { resolveToolAlias } from "@features/settings/context/tools/tool-alias-config"
import { sanitizeToolUseId } from "@utils/mcp"

import { ask } from "@features/chat/task/notifications/actions/ask"
import { systemBroadcast, userBroadcast } from "@features/chat/task/messages/actions/say"

import { pushToolResultToUserContent } from "@features/api/handlers/helpers/process/streaming"
import { validateToolUse } from "@features/chat/tools"
import { formatResponse } from "@features/settings/context/responses"

import { agentStore } from "@features/settings/agents/store/index"
import { createToolDescription, mutatingTools } from "./dispatchMaps"

function buildDisabledToolRequirements(disabledTools: string[]): Record<string, boolean> {
	return disabledTools.reduce(
		(acc: Record<string, boolean>, tool: string) => {
			acc[tool] = false
			const resolvedToolName = resolveToolAlias(tool)
			acc[resolvedToolName] = false
			return acc
		},
		{} as Record<string, boolean>,
	)
}

async function validateToolUseBlock(
	task: ITaskModel,
	block: ToolUse,
	toolCallId: string,
	mode: string | null,
	customModes: unknown,
	stateExperiments: Record<string, unknown>,
	disabledTools: string[],
): Promise<boolean> {
	const modelInfo = task.api!.getModel()
	const rawIncludedTools = modelInfo?.info?.includedTools
	const includedTools = rawIncludedTools?.map((tool) => resolveToolAlias(tool))

	try {
		const toolRequirements = buildDisabledToolRequirements(disabledTools)

		validateToolUse(
			block.name as ToolName,
			mode ?? defaultModeSlug,
			(customModes ?? []) as ModeConfig[],
			toolRequirements,
			block.params,
			stateExperiments as Record<string, boolean> | undefined,
			includedTools,
		)
	} catch (error) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		const validationError = error instanceof Error ? error.message : String(error)
		const errorContent = formatResponse.toolError(validationError)
		pushToolResultToUserContent(task.userMessageContent, {
			type: "tool_result",
			tool_use_id: sanitizeToolUseId(toolCallId),
			content: typeof errorContent === "string" ? errorContent : "(validation error)",
			is_error: true,
		})
		return false
	}
	return true
}

async function checkToolRepetition(
	task: ITaskModel,
	block: ToolUse,
	pushResult: (content: ToolResponse) => void,
): Promise<boolean> {
	const repetitionCheck = task.toolRepetitionDetector!.check(block)

	if (!repetitionCheck.allowExecution && repetitionCheck.askUser) {
		const { response, text, images } = await ask(
			task.taskId,
			repetitionCheck.askUser.messageKey as NotificationAsk,
			repetitionCheck.askUser.messageDetail.replace("{toolName}", block.name),
		)

		if (response === "messageResponse") {
			task.userMessageContent.push(
				{ type: "text" as const, text: `Tool repetition limit reached. User feedback: ${text}` },
				...formatResponse.imageBlocks(images),
			)
			await userBroadcast(task.taskId, "user_feedback", text, images)
		}

		getTelemetryService().captureConsecutiveMistakeError(task.taskId)
		getTelemetryService().captureException(
			new ConsecutiveMistakeError(
				`Tool repetition limit reached for ${block.name}`,
				task.taskId,
				task._state.consecutiveMistakeCount,
				task._state.consecutiveMistakeLimit,
				"tool_repetition",
				task.apiConfiguration.apiProvider,
				task.api!.getModel().id,
			),
		)

		pushResult(
			formatResponse.toolError(
				`Tool call repetition limit reached for ${block.name}. Please try a different approach.`,
			),
		)
		return false
	}
	return true
}

async function checkAgentToolPermission(
	task: ITaskModel,
	toolName: string,
	mode: string | null,
	pushResult: (content: ToolResponse) => void,
): Promise<boolean> {
	const modeSlug = mode ?? defaultModeSlug
	if (agentStore.agents.has(modeSlug)) {
		const agent = agentStore.agents.get(modeSlug)
		if (agent && !agent.canUseTool(toolName)) {
			const errorMessage = `Tool '${toolName}' is not allowed for your current role (${modeSlug}).`
			pushResult(formatResponse.toolError(errorMessage))
			return false
		}
	}
	return true
}

async function handleMissingToolCallId(task: ITaskModel, block: ToolUse): Promise<boolean> {
	if (block.id) {
		return false
	}

	const errorMessage =
		"Invalid tool call: missing tool_use.id. XML tool calls are no longer supported. Remove any XML tool markup (e.g. <read_file>...</read_file>) and use native tool calling instead."
	try {
		if (typeof block.name === "string") {
			task.recordToolError(block.name as ToolName, errorMessage)
		}
	} catch {
		// Best-effort only
	}
	task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
	await systemBroadcast(task.taskId, "error", errorMessage)
	task.userMessageContent.push({ type: "text", text: errorMessage })
	task._state.setDidAlreadyUseTool(true)
	return true
}

function handleRejectedToolBlock(task: ITaskModel, block: ToolUse, toolCallId: string): boolean {
	if (!task._state.didRejectTool) {
		return false
	}

	const isPartial = block.partial
	const prefix = isPartial ? "was interrupted and not executed" : "Skipping"
	const errorMessage = `${prefix} tool ${createToolDescription(block)} due to user rejecting a previous tool.`

	pushToolResultToUserContent(task.userMessageContent, {
		type: "tool_result",
		tool_use_id: sanitizeToolUseId(toolCallId),
		content: errorMessage,
		is_error: true,
	})
	return true
}

function isOrchestratorDelegationNeeded(mode: string | null, blockName: string): boolean {
	return mode === "orchestrator" && mutatingTools.includes(blockName)
}

export {
	buildDisabledToolRequirements,
	validateToolUseBlock,
	checkToolRepetition,
	checkAgentToolPermission,
	handleMissingToolCallId,
	handleRejectedToolBlock,
	isOrchestratorDelegationNeeded,
}
