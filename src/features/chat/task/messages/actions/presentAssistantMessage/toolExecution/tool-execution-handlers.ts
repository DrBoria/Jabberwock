import type { ToolUse, ToolResponse } from "@shared/tools"
import type { ITaskModel } from "@features/chat/task/store"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getBackendRootStore } from "@features/storeSingleton"
import { t } from "@i18n"
import {
	handleMissingToolCallId,
	handleRejectedToolBlock,
	validateToolUseBlock,
	checkToolRepetition,
	checkAgentToolPermission,
	isOrchestratorDelegationNeeded,
} from "@features/chat/task/messages/actions/presentAssistantMessage/validation"
import {
	createAskApproval,
	createHandleError,
	ToolResultState,
	handleToolResult,
	recordToolUsageForBlock,
	handleOrchestratorDelegation,
} from "@features/chat/task/messages/actions/presentAssistantMessage/helpers"
import { dispatchToolExecution } from "./tool-execution-dispatch"

async function handleNonPartialToolBlock(
	task: ITaskModel,
	block: ToolUse,
	toolCallId: string,
	mode: string | null,
	pushToolResult: (content: ToolResponse) => void,
): Promise<boolean> {
	const customModes = getBackendRootStore().settings.modes.customModes
	const stateExperiments: Record<string, unknown> = {}
	const disabledTools: string[] = []

	await recordToolUsageForBlock(task, block, stateExperiments)

	const isValid = await validateToolUseBlock(
		task,
		block,
		toolCallId,
		mode,
		customModes,
		stateExperiments,
		disabledTools,
	)
	if (!isValid) {
		return false
	}

	const canProceed = await checkToolRepetition(task, block, pushToolResult)
	if (!canProceed) {
		return false
	}

	if (block.name) {
		diagnosticsManager.setCurrentAction(t("diagnostics:actions.executingTool", { tool: block.name }))

		const hasPermission = await checkAgentToolPermission(task, block.name, mode, pushToolResult)
		if (!hasPermission) {
			return false
		}
	}

	try {
		getBackendRootStore().chat.toolCallStarted(block.name, JSON.stringify(block.params))
	} catch {
		// Silently ignore - store may not be initialized yet
	}

	return true
}

export async function handleToolBlock(task: ITaskModel, block: ToolUse): Promise<void> {
	if (await handleMissingToolCallId(task, block)) {
		return
	}

	const toolCallId = block.id!
	const mode: string | null = task.taskMode ?? null

	if (handleRejectedToolBlock(task, block, toolCallId)) {
		return
	}

	const toolResultState: ToolResultState = { hasToolResult: false }
	const pushToolResult = (content: ToolResponse) =>
		handleToolResult(task, toolCallId, content, block.name, toolResultState)

	const askForApproval = createAskApproval(task, pushToolResult)
	const handleError = createHandleError(task, pushToolResult, block.name)

	if (!block.partial) {
		const proceed = await handleNonPartialToolBlock(task, block, toolCallId, mode, pushToolResult)
		if (!proceed) {
			return
		}
	}

	if (isOrchestratorDelegationNeeded(mode, block.name)) {
		await handleOrchestratorDelegation(task, block, pushToolResult)
		return
	}

	await dispatchToolExecution(task, block, {
		askApproval: askForApproval,
		handleError,
		pushToolResult,
	})
}
