import { type ContextCondense, type ContextTruncation, type ModeConfig } from "@jabberwock/types"

import { ApiHandlerCreateMessageMetadata } from "../../../../api"
import { getModelMaxOutputTokens } from "../../../../shared/api"
import { buildNativeToolsArrayWithRestrictions } from "../../../chat/tools/actions"
import { manageContext } from "../../../foundation/time-machine/file-context"
import { getCurrentProfileId } from "./rateLimit"
import type { StreamHandle, AttemptApiRequestCallbacks } from "../../../chat/task/condense/actions/types"
import type { IBackendRootStore } from "../../../store"
import { getSettingsAccess } from "@utils/settings-access"

const FORCED_CONTEXT_REDUCTION_PERCENT = 75 // Keep 75% of context (remove 25%) on context window errors

/**
 * Maximum retries for context window errors.
 * Exported for use by the main attemptApiRequest function.
 */
export const MAX_CONTEXT_WINDOW_RETRIES = 3

/**
 * Handle context window exceeded error by forcing aggressive truncation.
 */
export async function handleContextWindowExceededError(
	task: StreamHandle,
	callbacks: AttemptApiRequestCallbacks,
	mode: string,
	profileThresholds: Record<string, number>,
	store: IBackendRootStore,
): Promise<void> {
	if (!task.api || !task.providerRef) {
		console.error(`[Task#${task.taskId}] Cannot handle context window error: api or providerRef not set`)
		return
	}
	const contextValues = getSettingsAccess().getValues()
	const { contextTokens } = task.tokenUsage ?? {}
	const modelInfo = task.api.getModel().info

	const maxTokens = getModelMaxOutputTokens({
		modelId: task.api.getModel().id,
		model: modelInfo,
		settings: task.apiConfiguration,
	})

	const contextWindow = modelInfo.contextWindow

	// Get the current profile ID using the helper method
	const currentProfileId = getCurrentProfileId(store)

	// Log the context window error for debugging
	console.warn(
		`[Task#${task.taskId}] Context window exceeded for model ${task.api.getModel().id}. ` +
			`Current tokens: ${contextTokens}, Context window: ${contextWindow}. ` +
			`Forcing truncation to ${FORCED_CONTEXT_REDUCTION_PERCENT}% of current context.`,
	)
	// Send condenseTaskContextStarted to show in-progress indicator
	await task.providerRef.deref()?.postMessageToWebview({ type: "condenseTaskContextStarted", text: task.taskId })

	// Build tools for condensing metadata (same tools used for normal API calls)
	const provider = task.providerRef.deref()
	let allTools: import("openai").default.Chat.ChatCompletionTool[] = []
	if (provider) {
		const toolsResult = await buildNativeToolsArrayWithRestrictions({
			cwd: task.cwd,
			mode,
			customModes: contextValues.customModes as ModeConfig[] | undefined,
			experiments: contextValues.experiments as Record<string, boolean> | undefined,
			apiConfiguration: task.apiConfiguration as { [key: string]: unknown } | undefined,
			disabledTools: contextValues.disabledTools as string[] | undefined,
			modelInfo,
			includeAllToolsWithRestrictions: false,
		})
		allTools = toolsResult.tools
	}

	// Build metadata with tools and taskId for the condensing API call
	const metadata: ApiHandlerCreateMessageMetadata = {
		mode,
		taskId: task.taskId,
		...(allTools.length > 0
			? {
					tools: allTools,
					tool_choice: "auto",
					parallelToolCalls: true,
				}
			: {}),
	}

	try {
		// Generate environment details to include in the condensed summary
		const environmentDetails = await callbacks.getEnvironmentDetails(true)

		// Force aggressive truncation by keeping only 75% of the conversation history
		const truncateResult = await manageContext({
			messages: task.apiConversationHistory,
			totalTokens: contextTokens || 0,
			maxTokens,
			contextWindow,
			apiHandler: task.api,
			autoCondenseContext: true,
			autoCondenseContextPercent: FORCED_CONTEXT_REDUCTION_PERCENT,
			systemPrompt: await callbacks.getSystemPrompt(),
			taskId: task.taskId,
			profileThresholds,
			currentProfileId,
			metadata,
			environmentDetails,
		})

		if (truncateResult.messages !== task.apiConversationHistory) {
			await callbacks.overwriteApiConversationHistory(truncateResult.messages)
		}

		if (truncateResult.summary) {
			const { summary, cost, prevContextTokens, newContextTokens = 0 } = truncateResult
			const contextCondense: ContextCondense = { summary, cost, newContextTokens, prevContextTokens }
			await callbacks.say(
				"condense_context",
				undefined /* text */,
				undefined /* images */,
				false /* partial */,
				undefined /* checkpoint */,
				undefined /* progressStatus */,
				{ isNonInteractive: true } /* options */,
				contextCondense,
			)
		} else if (truncateResult.truncationId) {
			// Sliding window truncation occurred (fallback when condensing fails or is disabled)
			const contextTruncation: ContextTruncation = {
				truncationId: truncateResult.truncationId,
				messagesRemoved: truncateResult.messagesRemoved ?? 0,
				prevContextTokens: truncateResult.prevContextTokens,
				newContextTokens: truncateResult.newContextTokensAfterTruncation ?? 0,
			}
			await callbacks.say(
				"sliding_window_truncation",
				undefined /* text */,
				undefined /* images */,
				false /* partial */,
				undefined /* checkpoint */,
				undefined /* progressStatus */,
				{ isNonInteractive: true } /* options */,
				undefined /* contextCondense */,
				contextTruncation,
			)
		}
	} finally {
		// Notify webview that context management is complete (removes in-progress spinner)
		// IMPORTANT: Must always be sent to dismiss the spinner, even on error
		await task.providerRef.deref()?.postMessageToWebview({ type: "condenseTaskContextResponse", text: task.taskId })
	}
}
