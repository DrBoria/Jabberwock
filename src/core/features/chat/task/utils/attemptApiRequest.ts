import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import delay from "delay"
import { serializeError } from "serialize-error"

import {
	type ContextCondense,
	type ContextTruncation,
	type ClineApiReqCancelReason,
	type ClineMessage,
	type ClineAsk,
	type ClineSay,
	type ToolProgressStatus,
	type TokenUsage,
	type ToolUsage,
	type ToolName,
	type ProviderSettings,
	type TaskLike,
	type TaskMetadata,
	type TaskEvents,
	type ModelInfo,
	TaskStatus,
	TodoItem,
	JabberwockEventName,
	TelemetryEventName,
	getApiProtocol,
	getModelId,
	isRetiredProvider,
	isIdleAsk,
	isInteractiveAsk,
	isResumableAsk,
	QueuedMessage,
	DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	MAX_CHECKPOINT_TIMEOUT_SECONDS,
	MIN_CHECKPOINT_TIMEOUT_SECONDS,
	ConsecutiveMistakeError,
	MAX_MCP_TOOLS_THRESHOLD,
	countEnabledMcpTools,
} from "@jabberwock/types"

import { ApiHandler, ApiHandlerCreateMessageMetadata, buildApiHandler } from "../../../../../api"
import { ApiStream, ApiStreamChunk, GroundingSource } from "../../../../../api/transform/stream"
import { maybeRemoveImageBlocks } from "../../../../../api/transform/image-cleaning"
import { findLastIndex } from "../../../../../shared/array"
import { combineApiRequests } from "../../../../../shared/combineApiRequests"
import { combineCommandSequences } from "../../../../../shared/combineCommandSequences"
import { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "../../../../../shared/getApiMetrics"
import { ClineAskResponse } from "../../../../../shared/WebviewMessage"
import { defaultModeSlug, getModeBySlug } from "../../../../../shared/modes"
import { DiffStrategy, type ToolUse, type ToolParamName, toolParamNames } from "../../../../../shared/tools"
import { getModelMaxOutputTokens } from "../../../../../shared/api"
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../../../../../shared/cost"
import { getWorkspacePath } from "../../../../../utils/path"
import { sanitizeToolUseId } from "../../../../../utils/tool-id"
import { getTaskDirectoryPath } from "../../../../../utils/storage"
import { formatResponse } from "../../../../prompts/responses"
import { SYSTEM_PROMPT } from "../../../../prompts/system"
import { buildNativeToolsArrayWithRestrictions } from "../../../../task/build-tools"
import { ToolRepetitionDetector } from "../../../../tools/ToolRepetitionDetector"
import { restoreTodoListForTask } from "../../../../tools/UpdateTodoListTool"
import { FileContextTracker } from "../../../../context-tracking/FileContextTracker"
import { JabberwockIgnoreController } from "../../../../ignore/JabberwockIgnoreController"
import { JabberwockProtectedController } from "../../../../protect/JabberwockProtectedController"
import { VirtualWorkspace } from "../../../../fs/VirtualWorkspace"
import { type AssistantMessageContent, presentAssistantMessage } from "../../../../assistant-message"
import { NativeToolCallParser } from "../../../../assistant-message/NativeToolCallParser"
import { manageContext, willManageContext } from "../../../../context-management"
import { ClineProvider } from "../../../../webview/ClineProvider"
import { MultiSearchReplaceDiffStrategy } from "../../../../diff/strategies/multi-search-replace"
import {
	type ApiMessage,
	readApiMessages,
	saveApiMessages,
	readTaskMessages,
	saveTaskMessages,
	taskMetadata,
} from "../../../../task-persistence"
import { getEnvironmentDetails } from "../../../../environment/getEnvironmentDetails"
import { checkContextWindowExceededError } from "../../../../context/context-management/context-error-handling"
import {
	type CheckpointDiffOptions,
	type CheckpointRestoreOptions,
	getCheckpointService,
	checkpointSave,
	checkpointRestore,
	checkpointDiff,
} from "../../../../checkpoints"
import { processUserContentMentions } from "../../../../mentions/processUserContentMentions"
import { getMessagesSinceLastSummary, summarizeConversation, getEffectiveApiHistory } from "../../../../condense"
import { MessageQueueService } from "../../../../message-queue/MessageQueueService"
import { AutoApprovalHandler, checkAutoApproval } from "../../../../auto-approval"
import { MessageManager } from "../../../../message-manager"
import { validateAndFixToolResultIds } from "../../../../task/validateToolResultIds"
import { mergeConsecutiveApiMessages } from "../../../../task/mergeConsecutiveApiMessages"
import { diagnosticsManager } from "../../../../devtools/DiagnosticsManager"

import { overwriteApiConversationHistory as overwriteApiConversationHistoryAction } from "../actions/overwriteApiHistory"
import { getSystemPrompt as getSystemPromptAction } from "./systemPrompt"
import { buildCleanConversationHistory as buildCleanConversationHistoryAction } from "./conversationCleaner"

import { Task } from "../../../../task/Task"

const MAX_EXPONENTIAL_BACKOFF_SECONDS = 600 // 10 minutes
const FORCED_CONTEXT_REDUCTION_PERCENT = 75 // Keep 75% of context (remove 25%) on context window errors
const MAX_CONTEXT_WINDOW_RETRIES = 3 // Maximum retries for context window errors
const MAX_AUTO_RETRY_ATTEMPTS = 10 // Maximum retries for auto-retry loop to prevent infinite loops

/**
 * Get the current profile ID from state.
 */
function getCurrentProfileId(state: any): string {
	return (
		state?.listApiConfigMeta?.find((profile: any) => profile.name === state?.currentApiConfigName)?.id ?? "default"
	)
}

/**
 * Enforce the user-configured provider rate limit.
 */
export async function maybeWaitForProviderRateLimit(task: Task, retryAttempt: number): Promise<void> {
	const state = await task.providerRef.deref()?.getState()
	const rateLimitSeconds = state?.apiConfiguration?.rateLimitSeconds ?? task.apiConfiguration?.rateLimitSeconds ?? 0

	if (rateLimitSeconds <= 0 || !(Task as any).lastGlobalApiRequestTime) {
		return
	}

	const now = performance.now()
	const timeSinceLastRequest = now - (Task as any).lastGlobalApiRequestTime
	const rateLimitDelay = Math.ceil(
		Math.min(rateLimitSeconds, Math.max(0, rateLimitSeconds * 1000 - timeSinceLastRequest) / 1000),
	)

	// Only show the countdown UX on the first attempt. Retry flows have their own delay messaging.
	if (rateLimitDelay > 0 && retryAttempt === 0) {
		for (let i = rateLimitDelay; i > 0; i--) {
			// Send structured JSON data for i18n-safe transport
			const delayMessage = JSON.stringify({ seconds: i })
			await task.say("api_req_rate_limit_wait", delayMessage, undefined, true)
			await delay(1000)
		}
		// Finalize the partial message so the UI doesn't keep rendering an in-progress spinner.
		await task.say("api_req_rate_limit_wait", undefined, undefined, false)
	}
}

/**
 * Handle context window exceeded error by forcing aggressive truncation.
 */
export async function handleContextWindowExceededError(task: Task): Promise<void> {
	const state = await task.providerRef.deref()?.getState()
	const { profileThresholds = {}, mode, apiConfiguration } = state ?? {}

	const { contextTokens } = task.getTokenUsage()
	const modelInfo = task.api.getModel().info

	const maxTokens = getModelMaxOutputTokens({
		modelId: task.api.getModel().id,
		model: modelInfo,
		settings: task.apiConfiguration,
	})

	const contextWindow = modelInfo.contextWindow

	// Get the current profile ID using the helper method
	const currentProfileId = getCurrentProfileId(state)

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
			provider,
			cwd: task.cwd,
			mode,
			customModes: state?.customModes,
			experiments: state?.experiments,
			apiConfiguration,
			disabledTools: state?.disabledTools,
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
		const environmentDetails = await getEnvironmentDetails(task, true)

		// Force aggressive truncation by keeping only 75% of the conversation history
		const truncateResult = await manageContext({
			messages: task.apiConversationHistory,
			totalTokens: contextTokens || 0,
			maxTokens,
			contextWindow,
			apiHandler: task.api,
			autoCondenseContext: true,
			autoCondenseContextPercent: FORCED_CONTEXT_REDUCTION_PERCENT,
			systemPrompt: await getSystemPromptAction(task),
			taskId: task.taskId,
			profileThresholds,
			currentProfileId,
			metadata,
			environmentDetails,
		})

		if (truncateResult.messages !== task.apiConversationHistory) {
			await overwriteApiConversationHistoryAction(task, truncateResult.messages)
		}

		if (truncateResult.summary) {
			const { summary, cost, prevContextTokens, newContextTokens = 0 } = truncateResult
			const contextCondense: ContextCondense = { summary, cost, newContextTokens, prevContextTokens }
			await task.say(
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
			await task.say(
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

/**
 * Apply shared exponential backoff and countdown UX for auto-retry.
 */
export async function backoffAndAnnounce(task: Task, retryAttempt: number, error: any): Promise<void> {
	try {
		const state = await task.providerRef.deref()?.getState()
		const baseDelay = state?.requestDelaySeconds || 5

		let exponentialDelay = Math.min(
			Math.ceil(baseDelay * Math.pow(2, retryAttempt)),
			MAX_EXPONENTIAL_BACKOFF_SECONDS,
		)

		// Respect provider rate limit window
		let rateLimitDelay = 0
		const rateLimit = (state?.apiConfiguration ?? task.apiConfiguration)?.rateLimitSeconds || 0
		if ((Task as any).lastGlobalApiRequestTime && rateLimit > 0) {
			const elapsed = performance.now() - (Task as any).lastGlobalApiRequestTime
			rateLimitDelay = Math.ceil(Math.min(rateLimit, Math.max(0, rateLimit * 1000 - elapsed) / 1000))
		}

		// Prefer RetryInfo on 429 if present
		if (error?.status === 429) {
			const retryInfo = error?.errorDetails?.find(
				(d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
			)
			const match = retryInfo?.retryDelay?.match?.(/^(\d+)s$/)
			if (match) {
				exponentialDelay = Number(match[1]) + 1
			}
		}

		const finalDelay = Math.max(exponentialDelay, rateLimitDelay)
		if (finalDelay <= 0) {
			return
		}

		// Build header text; fall back to error message if none provided
		let headerText
		if (error.status) {
			// Include both status code (for ChatRow parsing) and detailed message (for error details)
			// Format: "<status>\n<message>" allows ChatRow to extract status via parseInt(text.substring(0,3))
			// while preserving the full error message in errorDetails for debugging
			const errorMessage = error?.message || "Unknown error"
			headerText = `${error.status}\n${errorMessage}`
		} else if (error?.message) {
			headerText = error.message
		} else {
			headerText = "Unknown error"
		}

		headerText = headerText ? `${headerText}\n` : ""

		// Show countdown timer with exponential backoff
		for (let i = finalDelay; i > 0; i--) {
			// Check abort flag during countdown to allow early exit
			if (task.abort) {
				throw new Error(`[Task#${task.taskId}] Aborted during retry countdown`)
			}

			await task.say("api_req_retry_delayed", `${headerText}<retry_timer>${i}</retry_timer>`, undefined, true)
			await delay(1000)
		}

		await task.say("api_req_retry_delayed", headerText, undefined, false)
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)

		if (task.abort && message.includes("Aborted during retry countdown")) {
			return
		}

		console.error("Exponential backoff failed:", err)
	}
}

/**
 * Attempt an API request with context management, retry logic, and streaming.
 * This is a generator function that yields API stream chunks.
 */
import { createTimerQueueStore } from "../../../../features/foundation/timer-queue/store"

let _timerQueue: ReturnType<typeof createTimerQueueStore> | undefined

function getTimerQueue(): ReturnType<typeof createTimerQueueStore> {
	if (!_timerQueue) {
		_timerQueue = createTimerQueueStore()
	}
	return _timerQueue
}

export async function* attemptApiRequest(
	task: Task,
	retryAttempt: number = 0,
	options: { skipProviderRateLimit?: boolean } = {},
): ApiStream {
	const state = await task.providerRef.deref()?.getState()

	const {
		apiConfiguration,
		autoApprovalEnabled,
		requestDelaySeconds,
		autoCondenseContext = true,
		autoCondenseContextPercent = 100,
		profileThresholds = {},
	} = state ?? {}

	const currentMode = task.taskMode || defaultModeSlug

	// Get condensing configuration for automatic triggers.
	const customCondensingPrompt = state?.customSupportPrompts?.CONDENSE

	if (!options.skipProviderRateLimit) {
		await maybeWaitForProviderRateLimit(task, retryAttempt)
	}

	// Update last request time right before making the request so that subsequent
	// requests — even from new subtasks — will honour the provider's rate-limit.
	//
	// NOTE: When recursivelyMakeClineRequests handles rate limiting, it sets the
	// timestamp earlier to include the environment details build. We still set it
	// here for direct callers (tests) and for the case where we didn't rate-limit
	// in the caller.
	;(Task as any).lastGlobalApiRequestTime = performance.now()

	const systemPrompt = await getSystemPromptAction(task)
	const { contextTokens } = task.getTokenUsage()

	if (contextTokens) {
		const modelInfo = task.api.getModel().info

		const maxTokens = getModelMaxOutputTokens({
			modelId: task.api.getModel().id,
			model: modelInfo,
			settings: task.apiConfiguration,
		})

		const contextWindow = modelInfo.contextWindow

		// Get the current profile ID using the helper method
		const currentProfileId = getCurrentProfileId(state)
		// Check if context management will likely run (threshold check)
		// This allows us to show an in-progress indicator to the user
		// We use the centralized willManageContext helper to avoid duplicating threshold logic
		const lastMessage = task.apiConversationHistory[task.apiConversationHistory.length - 1]
		const lastMessageContent = lastMessage?.content
		let lastMessageTokens = 0
		if (lastMessageContent) {
			lastMessageTokens = Array.isArray(lastMessageContent)
				? await task.api.countTokens(lastMessageContent)
				: await task.api.countTokens([{ type: "text", text: lastMessageContent as string }])
		}

		const contextManagementWillRun = willManageContext({
			totalTokens: contextTokens,
			contextWindow,
			maxTokens,
			autoCondenseContext,
			autoCondenseContextPercent,
			profileThresholds,
			currentProfileId,
			lastMessageTokens,
		})

		// Send condenseTaskContextStarted BEFORE manageContext to show in-progress indicator
		// This notification must be sent here (not earlier) because the early check uses stale token count
		// (before user message is added to history), which could incorrectly skip showing the indicator
		if (contextManagementWillRun && autoCondenseContext) {
			await task.providerRef
				.deref()
				?.postMessageToWebview({ type: "condenseTaskContextStarted", text: task.taskId })
		}

		// Build tools for condensing metadata (same tools used for normal API calls)
		// This ensures the condensing API call includes tool definitions for providers that need them
		let contextMgmtTools: import("openai").default.Chat.ChatCompletionTool[] = []
		{
			const provider = task.providerRef.deref()
			if (provider) {
				const toolsResult = await buildNativeToolsArrayWithRestrictions({
					provider,
					cwd: task.cwd,
					mode: currentMode,
					customModes: state?.customModes,
					experiments: state?.experiments,
					apiConfiguration,
					disabledTools: state?.disabledTools,
					modelInfo,
					includeAllToolsWithRestrictions: false,
				})
				contextMgmtTools = toolsResult.tools
			}
		}

		// Build metadata with tools and taskId for the condensing API call
		const contextMgmtMetadata: ApiHandlerCreateMessageMetadata = {
			mode: currentMode,
			taskId: task.taskId,
			...(contextMgmtTools.length > 0
				? {
						tools: contextMgmtTools,
						tool_choice: "auto",
						parallelToolCalls: true,
					}
				: {}),
		}

		// Only generate environment details when context management will actually run.
		// getEnvironmentDetails(this, true) triggers a recursive workspace listing which
		// adds overhead - avoid this for the common case where context is below threshold.
		const contextMgmtEnvironmentDetails = contextManagementWillRun
			? await getEnvironmentDetails(task, true)
			: undefined

		// Get files read by Jabberwock for code folding - only when context management will run
		const contextMgmtFilesReadByRoo =
			contextManagementWillRun && autoCondenseContext
				? await task.getFilesReadByJabberwockSafely("attemptApiRequest")
				: undefined

		try {
			const truncateResult = await manageContext({
				messages: task.apiConversationHistory,
				totalTokens: contextTokens,
				maxTokens,
				contextWindow,
				apiHandler: task.api,
				autoCondenseContext,
				autoCondenseContextPercent,
				systemPrompt,
				taskId: task.taskId,
				customCondensingPrompt,
				profileThresholds,
				currentProfileId,
				metadata: contextMgmtMetadata,
				environmentDetails: contextMgmtEnvironmentDetails,
				filesReadByJabberwock: contextMgmtFilesReadByRoo,
				cwd: task.cwd,
				jabberwockIgnoreController: task.jabberwockIgnoreController,
			})
			if (truncateResult.messages !== task.apiConversationHistory) {
				await overwriteApiConversationHistoryAction(task, truncateResult.messages)
			}
			if (truncateResult.error) {
				await task.say("condense_context_error", truncateResult.error)
			}
			if (truncateResult.summary) {
				const { summary, cost, prevContextTokens, newContextTokens = 0, condenseId } = truncateResult
				const contextCondense: ContextCondense = {
					summary,
					cost,
					newContextTokens,
					prevContextTokens,
					condenseId,
				}
				await task.say(
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
				await task.say(
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
			// Notify webview that context management is complete (sets isCondensing = false)
			// This removes the in-progress spinner and allows the completed result to show
			// IMPORTANT: Must always be sent to dismiss the spinner, even on error
			if (contextManagementWillRun && autoCondenseContext) {
				await task.providerRef
					.deref()
					?.postMessageToWebview({ type: "condenseTaskContextResponse", text: task.taskId })
			}
		}
	}

	// Phase 4: Filter history based on Tree structure
	let baseHistory = task.apiConversationHistory
	const providerInstance = task.providerRef.deref()
	if (providerInstance && providerInstance.chatStore) {
		const store = providerInstance.chatStore
		const history = []
		let currentNodeId: string | undefined = task.taskId

		while (currentNodeId) {
			const node = store.nodes.get(currentNodeId)
			if (!node) break

			// Pull messages from the node (stored as ApiMessage in 'content' field)
			const nodeMessages = node.messages.map((m: any) => m.content as ApiMessage)
			history.unshift(...nodeMessages)

			currentNodeId = node.parentId
		}

		if (history.length > 0) {
			baseHistory = history
		}
	}

	const effectiveHistory = getEffectiveApiHistory(baseHistory)
	const messagesSinceLastSummary = getMessagesSinceLastSummary(effectiveHistory)
	// For API only: merge consecutive user messages (excludes summary messages per
	// mergeConsecutiveApiMessages implementation) without mutating stored history.
	const mergedForApi = mergeConsecutiveApiMessages(messagesSinceLastSummary, { roles: ["user"] })
	const messagesWithoutImages = maybeRemoveImageBlocks(mergedForApi, task.api)
	const cleanConversationHistory = buildCleanConversationHistoryAction(task, messagesWithoutImages as ApiMessage[])

	// Check auto-approval limits
	const approvalResult = await task.autoApprovalHandler.checkAutoApprovalLimits(
		state,
		task.combineMessages(task.clineMessages.slice(1)),
		async (type: any, data: any) => task.ask(type, data),
	)

	if (!approvalResult.shouldProceed) {
		// User did not approve, task should be aborted
		throw new Error("Auto-approval limit reached and user did not approve continuation")
	}

	// Whether we include tools is determined by whether we have any tools to send.
	const modelInfo = task.api.getModel().info

	// Build complete tools array: native tools + dynamic MCP tools
	// When includeAllToolsWithRestrictions is true, returns all tools but provides
	// allowedFunctionNames for providers (like Gemini) that need to see all tool
	// definitions in history while restricting callable tools for the current mode.
	// Only Gemini currently supports this - other providers filter tools normally.
	let allTools: OpenAI.Chat.ChatCompletionTool[] = []
	let allowedFunctionNames: string[] | undefined

	// Gemini requires all tool definitions to be present for history compatibility,
	// but uses allowedFunctionNames to restrict which tools can be called.
	// Other providers (Anthropic, OpenAI, etc.) don't support this feature yet,
	// so they continue to receive only the filtered tools for the current mode.
	const supportsAllowedFunctionNames = apiConfiguration?.apiProvider === "gemini"

	{
		const provider = task.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost during tool building")
		}

		const toolsResult = await buildNativeToolsArrayWithRestrictions({
			provider,
			cwd: task.cwd,
			mode: currentMode,
			customModes: state?.customModes,
			experiments: state?.experiments,
			apiConfiguration,
			disabledTools: state?.disabledTools,
			modelInfo,
			includeAllToolsWithRestrictions: supportsAllowedFunctionNames,
		})
		allTools = toolsResult.tools
		allowedFunctionNames = toolsResult.allowedFunctionNames
	}

	const shouldIncludeTools = allTools.length > 0

	const metadata: ApiHandlerCreateMessageMetadata = {
		mode: currentMode,
		taskId: task.taskId,
		suppressPreviousResponseId: task.skipPrevResponseIdOnce,
		...(shouldIncludeTools
			? {
					tools: allTools,
					tool_choice: "auto",
					parallelToolCalls: true,
					...(allowedFunctionNames ? { allowedFunctionNames } : {}),
				}
			: {}),
	}

	// Log the final tools being sent to the API
	const mcpToolNames = allTools
		.map((t) => (t as OpenAI.Chat.ChatCompletionFunctionTool).function.name)
		.filter((name) => name.startsWith("mcp_") || name.startsWith("mcp--"))
	const nativeToolNames = allTools
		.map((t) => (t as OpenAI.Chat.ChatCompletionFunctionTool).function.name)
		.filter((name) => !name.startsWith("mcp_") && !name.startsWith("mcp--"))

	const cleanConversationHistoryForLogs = JSON.parse(JSON.stringify(cleanConversationHistory))
	if (cleanConversationHistoryForLogs.length > 0) {
		for (const msg of cleanConversationHistoryForLogs) {
			if (Array.isArray(msg.content)) {
				for (const block of msg.content) {
					if (block.type === "text" && typeof block.text === "string") {
						// Filter out <environment_details> block for cleaner logs
						block.text = block.text.replace(
							/<environment_details>[\s\S]*?<\/environment_details>/g,
							"<environment_details>\n... [Omitted for logs] ...\n</environment_details>",
						)
					}
				}
			} else if (typeof msg.content === "string") {
				msg.content = msg.content.replace(
					/<environment_details>[\s\S]*?<\/environment_details>/g,
					"<environment_details>\n... [Omitted for logs] ...\n</environment_details>",
				)
			}
		}
	}

	// Only log DEBUG: PROMPT when explicitly enabled via env var (avoids console noise)
	if (process.env.DEBUG_PROMPT === "true") {
		console.log("\n\n=======================================================\n")
		console.log(`[DEBUG: PROMPT] Final SYSTEM prompt sent to agent:\n\n${systemPrompt}`)
		console.log("\n=======================================================\n")
		console.log(
			`[DEBUG: PROMPT] Final USER/ASSISTANT messages sent to agent:\n\n${JSON.stringify(cleanConversationHistoryForLogs, null, 2)}`,
		)
		console.log("\n=======================================================\n")
		console.log(`[DEBUG: PROMPT] native tools (${nativeToolNames.length}): ${nativeToolNames.join(", ")}`)
		console.log(`[DEBUG: PROMPT] MCP tools (${mcpToolNames.length}): ${mcpToolNames.join(", ")}`)
		console.log(`[DEBUG: PROMPT] Tools JSON schema sent to agent:\n${JSON.stringify(allTools, null, 2)}`)

		if (allowedFunctionNames) {
			console.log(
				`[DEBUG: PROMPT] allowedFunctionNames (${allowedFunctionNames.length}): ${allowedFunctionNames.join(", ")}`,
			)
		}
	}

	// Create an AbortController to allow cancelling the request mid-stream
	const ac = new AbortController()
	task.currentRequestAbortController = ac
	const abortSignal = ac.signal as AbortSignal
	// Reset the flag after using it
	task.skipPrevResponseIdOnce = false

	// The provider accepts reasoning items alongside standard messages; cast to the expected parameter type.
	const stream = task.api.createMessage(
		systemPrompt,
		cleanConversationHistory as unknown as Anthropic.Messages.MessageParam[],
		metadata,
	)
	const iterator = stream[Symbol.asyncIterator]()

	// Set up abort handling - when the signal is aborted, clean up the controller reference
	abortSignal.addEventListener("abort", () => {
		const taskId = task.taskId
		const instanceId = task.instanceId
		console.log(`[Task#${taskId}.${instanceId}] AbortSignal triggered for current request`)
		task.currentRequestAbortController = undefined
	})

	const abortPromise = new Promise<never>((_, reject) => {
		if (abortSignal.aborted) {
			reject(new Error("Request cancelled by user"))
		} else {
			abortSignal.addEventListener("abort", () => {
				reject(new Error("Request cancelled by user"))
			})
		}
	})

	try {
		// Awaiting first chunk to see if it will throw an error.
		task["isWaitingForFirstChunk"] = true

		// Race between the first chunk and the abort signal
		const firstChunkPromise = iterator.next()

		const timeoutId = `first-chunk-timeout-${task.taskId}-${Date.now()}`
		getTimerQueue().schedule({
			id: timeoutId,
			label: "First chunk timeout (attemptApiRequest)",
			timeoutMs: 300000,
		})
		const timeoutPromise = getTimerQueue().createTimeoutPromise(
			timeoutId,
			"Request timed out after 300 seconds (waiting for local model TTFB)",
		)

		const firstChunk: IteratorResult<ApiStreamChunk> = await Promise.race([
			firstChunkPromise,
			abortPromise,
			timeoutPromise,
		])
		getTimerQueue().cancel(timeoutId)
		yield firstChunk.value
		Object.assign(task, { isWaitingForFirstChunk: false })
	} catch (error) {
		Object.assign(task, { isWaitingForFirstChunk: false })
		task.currentRequestAbortController = undefined
		const isContextWindowExceededError = checkContextWindowExceededError(error)

		// If it's a context window error and we haven't exceeded max retries for this error type
		if (isContextWindowExceededError && retryAttempt < MAX_CONTEXT_WINDOW_RETRIES) {
			console.warn(
				`[Task#${task.taskId}] Context window exceeded for model ${task.api.getModel().id}. ` +
					`Retry attempt ${retryAttempt + 1}/${MAX_CONTEXT_WINDOW_RETRIES}. ` +
					`Attempting automatic truncation...`,
			)
			await handleContextWindowExceededError(task)
			// Retry the request after handling the context window error
			yield* attemptApiRequest(task, retryAttempt + 1)
			return
		}

		// note that this api_req_failed ask is unique in that we only present this option if the api hasn't streamed any content yet (ie it fails on the first chunk due), as it would allow them to hit a retry button. However if the api failed mid-stream, it could be in any arbitrary state where some tools may have executed, so that error is handled differently and requires cancelling the task entirely.
		if (autoApprovalEnabled) {
			// Prevent infinite retry loops by enforcing a maximum retry limit.
			// Non-transient errors (e.g., timerQueue initialization failure, provider config errors)
			// will never succeed on retry, so we must stop after a reasonable number of attempts.
			if (retryAttempt >= MAX_AUTO_RETRY_ATTEMPTS) {
				console.error(
					`[Task#${task.taskId}] Auto-retry limit reached (${MAX_AUTO_RETRY_ATTEMPTS}). ` +
						`Giving up on request. Error: ${(error as any)?.message ?? String(error)}`,
				)
				throw new Error(
					`[Task#attemptApiRequest] task ${task.taskId}.${task.instanceId} ` +
						`auto-retry limit reached after ${MAX_AUTO_RETRY_ATTEMPTS} attempts. ` +
						`Last error: ${(error as any)?.message ?? String(error)}`,
				)
			}

			// Apply shared exponential backoff and countdown UX
			await backoffAndAnnounce(task, retryAttempt, error)

			// CRITICAL: Check if task was aborted during the backoff countdown
			// This prevents infinite loops when users cancel during auto-retry
			// Without this check, the recursive call below would continue even after abort
			if (task.abort) {
				throw new Error(`[Task#attemptApiRequest] task ${task.taskId}.${task.instanceId} aborted during retry`)
			}

			// Delegate generator output from the recursive call with
			// incremented retry count.
			yield* attemptApiRequest(task, retryAttempt + 1)

			return
		} else {
			const { response } = await task.ask(
				"api_req_failed",
				(error as any).message ?? JSON.stringify(serializeError(error), null, 2),
			)

			if (response !== "yesButtonClicked") {
				// This will never happen since if noButtonClicked, we will
				// clear current task, aborting this instance.
				throw new Error("API request failed")
			}

			await task.say("api_req_retried")

			// Delegate generator output from the recursive call.
			yield* attemptApiRequest(task)
			return
		}
	}

	// No error, so we can continue to yield all remaining chunks.
	// We implement a 120-second inactivity timeout per chunk to prevent infinite hangs mid-stream.
	while (true) {
		const inactivityTimeoutId = `inactivity-timeout-${task.taskId}-${Date.now()}`
		getTimerQueue().schedule({
			id: inactivityTimeoutId,
			label: "Inactivity timeout (attemptApiRequest)",
			timeoutMs: 120000,
		})
		const timeoutPromise = getTimerQueue().createTimeoutPromise(
			inactivityTimeoutId,
			"Request timed out after 120 seconds of inactivity",
		)

		const nextChunkPromise = iterator.next()
		const chunk = await Promise.race([nextChunkPromise, abortPromise, timeoutPromise])
		getTimerQueue().cancel(inactivityTimeoutId)

		if (chunk.done) {
			break
		}
		yield chunk.value
	}
}
