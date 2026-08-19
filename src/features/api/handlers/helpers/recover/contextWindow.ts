import { type ContextCondense, type ContextTruncation, type ModeConfig } from "@jabberwock/types"

import { ApiHandlerCreateMessageMetadata } from "@api"
import { getModelMaxOutputTokens } from "@shared/api"
import { buildNativeToolsArrayWithRestrictions } from "@features/chat/tools/actions"
import { manageContext } from "@features/foundation/time-machine/file-context"

import type { StreamHandle, AttemptApiRequestCallbacks } from "@features/chat/task/condense/actions/types"
import type { IBackendRootStore } from "@features/store"
import { getSettingsAccess } from "@utils/settings"
import {
	sendCondenseTaskContextStarted,
	sendCondenseTaskContextResponse,
} from "@features/api/events/actions/sendCondenseEvent"

const FORCED_CONTEXT_REDUCTION_PERCENT = 75

/**
 * Maximum retries for context window errors.
 */
export const MAX_CONTEXT_WINDOW_RETRIES = 3

function buildCondenseNotification(
	taskId: string,
	callbacks: AttemptApiRequestCallbacks,
	truncateResult: Awaited<ReturnType<typeof manageContext>>,
): void {
	if (!truncateResult.summary) {
		return
	}

	const { summary, cost, prevContextTokens, newContextTokens = 0 } = truncateResult
	const contextCondense: ContextCondense = { summary, cost, newContextTokens, prevContextTokens }
	void callbacks.say(
		"condense_context",
		undefined,
		undefined,
		false,
		undefined,
		undefined,
		{ isNonInteractive: true },
		contextCondense,
	)
}

function buildTruncationNotification(
	taskId: string,
	callbacks: AttemptApiRequestCallbacks,
	truncateResult: Awaited<ReturnType<typeof manageContext>>,
): void {
	if (!truncateResult.truncationId) {
		return
	}

	const contextTruncation: ContextTruncation = {
		truncationId: truncateResult.truncationId,
		messagesRemoved: truncateResult.messagesRemoved ?? 0,
		prevContextTokens: truncateResult.prevContextTokens,
		newContextTokens: truncateResult.newContextTokensAfterTruncation ?? 0,
	}
	void callbacks.say(
		"sliding_window_truncation",
		undefined,
		undefined,
		false,
		undefined,
		undefined,
		{ isNonInteractive: true },
		undefined,
		contextTruncation,
	)
}

/**
 * Handle context window exceeded error by forcing aggressive truncation.
 */
// eslint-disable-next-line complexity -- Logic spans context-window, truncation, and tool-result notifications
export async function handleContextWindowExceededError(
	task: StreamHandle,
	callbacks: AttemptApiRequestCallbacks,
	mode: string,
	profileThresholds: Record<string, number>,
	store: IBackendRootStore,
): Promise<void> {
	if (!task.api) {
		console.error(`[Task#${task.taskId}] Cannot handle context window error: api not set`)
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
	const apiConfig = store.settings?.apiConfig
	const list = apiConfig?.listApiConfigMeta ?? []
	const currentName = apiConfig?.currentConfigName ?? "default"
	const currentProfileId =
		list.find((profile: { name: string; id?: string }) => profile.name === currentName)?.id ?? "default"

	console.warn(
		`[Task#${task.taskId}] Context window exceeded for model ${task.api.getModel().id}. ` +
			`Current tokens: ${contextTokens}, Context window: ${contextWindow}. ` +
			`Forcing truncation to ${FORCED_CONTEXT_REDUCTION_PERCENT}% of current context.`,
	)
	sendCondenseTaskContextStarted(task.taskId)

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
	const allTools = toolsResult.tools

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
		const environmentDetails = await callbacks.getEnvironmentDetails(true)

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

		buildCondenseNotification(task.taskId, callbacks, truncateResult)
		buildTruncationNotification(task.taskId, callbacks, truncateResult)
	} finally {
		sendCondenseTaskContextResponse(task.taskId)
	}
}
