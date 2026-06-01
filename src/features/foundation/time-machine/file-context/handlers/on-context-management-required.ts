import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"
import { manageContext } from "../index"

/**
 * Handles context.management.required intent — triggers context management
 * (condensation or sliding-window truncation) for a task.
 *
 * The handler fetches the task from the store, extracts current context data,
 * and delegates to the standalone manageContext() utility.
 */
export function registerOnContextManagementRequired(bus: IntentBus): void {
	bus.register(IntentType.ContextManagementRequired, async (intent, ctx) => {
		const {
			taskId,
			autoCondenseContext,
			autoCondenseContextPercent,
			systemPrompt,
			environmentDetails,
			filesReadByJabberwock,
			cwd,
		} = intent.payload as {
			taskId: string
			autoCondenseContext: boolean
			autoCondenseContextPercent: number
			systemPrompt: string
			environmentDetails?: string
			filesReadByJabberwock?: string[]
			cwd?: string
		}

		const task = ctx.rootStore.chat.tasks.get(taskId)
		if (!task) {
			console.error(`[onContextManagementRequired] Task ${taskId} not found`)
			return
		}

		const modelInfo = task.api?.getModel().info
		const contextWindow = modelInfo?.contextWindow ?? 128_000

		// Calculate maxTokens per model config
		const taskApiConfig = task.apiConfiguration
		const maxTokens = taskApiConfig?.modelMaxTokens ?? undefined

		// Get the current context token count from task's token usage snapshot
		const contextTokens = task.tokenUsage?.contextTokens ?? 0

		// Read profile thresholds from settings store
		const profileThresholds: Record<string, number> = {}
		const currentProfileId = "default"

		// Build metadata for the condensing API call
		const metadata = {
			mode: task.taskMode,
			taskId,
		}

		// Delegate to the standalone manageContext utility
		const truncateResult = await manageContext({
			messages: task.apiConversationHistory,
			totalTokens: contextTokens,
			contextWindow,
			maxTokens,
			apiHandler: task.api!,
			autoCondenseContext,
			autoCondenseContextPercent,
			systemPrompt,
			taskId,
			profileThresholds,
			currentProfileId,
			metadata,
			environmentDetails,
			filesReadByJabberwock,
			cwd,
		})

		// If messages changed, update the task's conversation history
		if (truncateResult.messages !== task.apiConversationHistory) {
			// Replace in-place since apiConversationHistory is a mutable array
			task.apiConversationHistory.length = 0
			task.apiConversationHistory.push(...truncateResult.messages)
		}

		// Emit a notification on the task for the result
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
	})
}
