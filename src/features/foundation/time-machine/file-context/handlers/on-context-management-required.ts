import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import type { ITaskModel } from "@features/chat/task/store"
import { manageContext } from "@features/foundation/time-machine/file-context/index"
import type { ContextManagementResult } from "@features/foundation/time-machine/file-context/index"

/**
 * Handles context.management.required intent — triggers context management
 * (condensation or sliding-window truncation) for a task.
 *
 * The handler fetches the task from the store, extracts current context data,
 * and delegates to the standalone manageContext() utility.
 */
export function registerOnContextManagementRequired(bus: IntentBus): void {
	bus.register(IntentType.ContextManagementRequired, async (intent, ctx) => {
		const payload = intent.payload as ContextManagementPayload

		const task = ctx.rootStore.chat.tasks.get(payload.taskId)
		if (!task) {
			console.error(`[onContextManagementRequired] Task ${payload.taskId} not found`)
			return
		}

		const modelInfo = task.api?.getModel().info
		const contextWindow = modelInfo?.contextWindow ?? 128_000
		const maxTokens = task.apiConfiguration?.modelMaxTokens ?? undefined
		const contextTokens = task.tokenUsage?.contextTokens ?? 0
		const profileThresholds: Record<string, number> = {}
		const currentProfileId = "default"

		const metadata = {
			mode: task.taskMode,
			taskId: payload.taskId,
		}

		const truncateResult = await manageContext({
			messages: task.apiConversationHistory,
			totalTokens: contextTokens,
			contextWindow,
			maxTokens,
			apiHandler: task.api!,
			autoCondenseContext: payload.autoCondenseContext,
			autoCondenseContextPercent: payload.autoCondenseContextPercent,
			systemPrompt: payload.systemPrompt,
			taskId: payload.taskId,
			profileThresholds,
			currentProfileId,
			metadata,
			environmentDetails: payload.environmentDetails,
			filesReadByJabberwock: payload.filesReadByJabberwock,
			cwd: payload.cwd,
		})

		handleTruncationResult(task, truncateResult)
	})
}

interface ContextManagementPayload {
	taskId: string
	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	systemPrompt: string
	environmentDetails?: string
	filesReadByJabberwock?: string[]
	cwd?: string
}

function handleTruncationResult(task: ITaskModel, truncateResult: ContextManagementResult): void {
	if (truncateResult.messages !== task.apiConversationHistory) {
		task.apiConversationHistory.length = 0
		task.apiConversationHistory.push(...truncateResult.messages)
	}

	if (truncateResult.summary) {
		task.emit?.("context.condensed", {
			summary: truncateResult.summary,
			cost: truncateResult.cost,
			prevContextTokens: truncateResult.prevContextTokens,
			newContextTokens: truncateResult.newContextTokens ?? 0,
		})
	} else if (truncateResult.truncationId) {
		task.emit?.("context.truncated", {
			truncationId: truncateResult.truncationId,
			messagesRemoved: truncateResult.messagesRemoved ?? 0,
			prevContextTokens: truncateResult.prevContextTokens,
			newContextTokens: truncateResult.newContextTokensAfterTruncation ?? 0,
		})
	}
}
