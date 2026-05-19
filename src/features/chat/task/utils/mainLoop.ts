import { Anthropic } from "@anthropic-ai/sdk"
import { serializeError } from "serialize-error"

import {
	type ClineApiReqCancelReason,
	type ClineApiReqInfo,
	type ModelInfo,
	getApiProtocol,
	getModelId,
	isRetiredProvider,
	ConsecutiveMistakeError,
} from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

import { GroundingSource, type ApiStreamChunk } from "../../../../api/transform/stream"
import { findLastIndex } from "../../../../shared/array"
import { t } from "../../../../i18n"
import { formatResponse } from "../../../../core/prompts/responses"
import { defaultModeSlug, getModeBySlug } from "../../../../shared/modes"

import { Task } from "../Task"
import { getTimerQueue } from "../../../foundation/timer-queue/getTimerQueue"
import { presentAssistantMessage } from "../../../../core/assistant-message"
import { NativeToolCallParser } from "../../../../core/assistant-message/NativeToolCallParser"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getEnvironmentDetails } from "../../../../core/environment/getEnvironmentDetails"
import { processUserContentMentions } from "../../../../core/mentions/processUserContentMentions"

import { createChunkHandlers, updateApiReqMsg } from "./streamChunkHandlers"
import {
	buildAssistantContentForApi,
	enforceNewTaskIsolation,
	saveAssistantMessageToHistory,
	waitForToolExecutionAndPrepareNextContent,
} from "./toolCallExecutor"
import {
	createAbortPromise,
	createFirstChunkTimeoutPromise,
	abortStream,
	resetStreamingState,
	drainStreamInBackground,
} from "./requestAbortManager"
import { type TaskDelegate } from "./types"
import { postStateToWebviewWithoutTaskHistory, handleModeSwitch } from "../../../foundation/window-manager/store"
import { getSkillsManager } from "../../../settings/skills/store"

/**
 * Interface for the stack items used in the main loop.
 */
interface StackItem {
	userContent: Anthropic.Messages.ContentBlockParam[]
	includeFileDetails: boolean
	retryAttempt?: number
	userMessageWasRemoved?: boolean
}

/**
 * Runs the main orchestration loop for recursively making API requests.
 *
 * This function encapsulates the while-loop body that was previously inline
 * in Task.recursivelyMakeClineRequests(). It handles:
 * - Stack-based iteration for retry/delegation
 * - Mistake limit checking
 * - Environment details processing
 * - API request setup and streaming
 * - Chunk dispatch via streamChunkHandlers
 * - Post-stream finalization (tool calls, assistant message saving)
 * - Error handling and retry logic
 *
 * @returns true if the task should end, false if the loop completed normally.
 */
export async function runMainLoop(
	task: Task,
	userContent: Anthropic.Messages.ContentBlockParam[],
	includeFileDetails: boolean = false,
): Promise<boolean> {
	const delegate = task as Task & TaskDelegate

	const stack: StackItem[] = [{ userContent, includeFileDetails, retryAttempt: 0 }]

	while (stack.length > 0) {
		const currentItem = stack.pop()!
		const currentUserContent = currentItem.userContent
		const currentIncludeFileDetails = currentItem.includeFileDetails

		if (task.abort || task.turnResetPending) {
			throw new Error(
				`[Jabberwock#recursivelyMakeRooRequests] task ${task.taskId}.${task.instanceId} aborted or resetPending`,
			)
		}

		// ── Mistake limit check ──────────────────────────────────────────
		const consecutiveMistakeLimit = task.consecutiveMistakeLimit
		const consecutiveMistakeCount = task.consecutiveMistakeCount
		if (consecutiveMistakeLimit > 0 && consecutiveMistakeCount >= consecutiveMistakeLimit) {
			const tskConfig = delegate.apiConfiguration
			getTelemetryService().captureConsecutiveMistakeError(task.taskId)
			getTelemetryService().captureException(
				new ConsecutiveMistakeError(
					`Task reached consecutive mistake limit (${String(consecutiveMistakeLimit)})`,
					task.taskId,
					consecutiveMistakeCount,
					consecutiveMistakeLimit,
					"no_tools_used",
					tskConfig.apiProvider as string | undefined,
					getModelId(tskConfig as Parameters<typeof getModelId>[0]),
				),
			)

			const { response, text, images } = await task.ask(
				"mistake_limit_reached",
				t("common:errors.mistake_limit_guidance"),
			)

			if (response === "messageResponse") {
				currentUserContent.push(
					...[
						{ type: "text" as const, text: formatResponse.tooManyMistakes(text) },
						...formatResponse.imageBlocks(images),
					],
				)

				await task.say("user_feedback", text, images)
			}

			task.consecutiveMistakeCount = 0
		}

		// ── API protocol & rate limiting ─────────────────────────────────
		const tskConfig = delegate.apiConfiguration
		const modelId = getModelId(tskConfig as Parameters<typeof getModelId>[0])
		const apiProvider = tskConfig.apiProvider as Parameters<typeof getApiProtocol>[0]
		const apiProtocol = getApiProtocol(
			apiProvider && !isRetiredProvider(apiProvider as Parameters<typeof isRetiredProvider>[0])
				? apiProvider
				: undefined,
			modelId,
		)

		await delegate.maybeWaitForProviderRateLimit(currentItem.retryAttempt ?? 0)
		Task.lastGlobalApiRequestTime = performance.now()

		await task.say("api_req_started", JSON.stringify({ apiProtocol }))

		// [TODO-LOG] Stream start
		const todoLogMsg = `[TODO-LOG] [Task] Stream start (taskId: ${task.taskId}, model: ${modelId})`
		console.log(todoLogMsg)
		diagnosticsManager.log(todoLogMsg, "info")
		const provider = delegate.providerRef.deref()
		const state = provider ? await (provider.getState as () => Promise<Record<string, unknown>>)() : undefined

		const showJabberwockIgnoredFiles = (state?.showJabberwockIgnoredFiles as boolean | undefined) ?? false
		const includeDiagnosticMessages = (state?.includeDiagnosticMessages as boolean | undefined) ?? true
		const maxDiagnosticMessages = (state?.maxDiagnosticMessages as number | undefined) ?? 50
		const currentMode = (state?.mode as string | undefined) ?? defaultModeSlug

		// ── Process user content mentions ────────────────────────────────
		const { content: parsedUserContent, mode: slashCommandMode } = await processUserContentMentions({
			userContent: currentUserContent,
			cwd: task.cwd,
			fileContextTracker: task.fileContextTracker,
			jabberwockIgnoreController: task.jabberwockIgnoreController,
			showJabberwockIgnoredFiles,
			includeDiagnosticMessages,
			maxDiagnosticMessages,
			skillsManager: provider ? getSkillsManager(provider as Parameters<typeof getSkillsManager>[0]) : undefined,
			currentMode,
		})

		// Switch mode if specified in a slash command's frontmatter
		if (slashCommandMode) {
			const providerRef = delegate.providerRef
			const providerRefValue = providerRef.deref()
			if (providerRefValue) {
				const providerState = await (providerRefValue.getState as () => Promise<Record<string, unknown>>)()
				const targetMode = getModeBySlug(
					slashCommandMode,
					providerState?.customModes as Parameters<typeof getModeBySlug>[1],
				)
				if (targetMode) {
					await handleModeSwitch(providerRefValue, slashCommandMode)
				}
			}
		}

		// ── Environment details ──────────────────────────────────────────
		diagnosticsManager.setCurrentAction(t("diagnostics:actions.environmentDetails"))
		const envStartTime = Date.now()
		console.log(`[DEBUG: TaskLoop#${task.taskId}] Phase: Environment Details Start`)
		const environmentDetails = await getEnvironmentDetails(task, currentIncludeFileDetails)
		console.log(
			`[DEBUG: TaskLoop#${task.taskId}] Phase: Environment Details Complete (${Date.now() - envStartTime}ms)`,
		)

		// Remove any existing environment_details blocks before adding fresh ones.
		const contentWithoutEnvDetails = parsedUserContent.filter((block) => {
			if (block.type === "text" && typeof block.text === "string") {
				const isEnvironmentDetailsBlock =
					(block.text as string).trim().startsWith("<environment_details>") &&
					(block.text as string).trim().endsWith("</environment_details>")
				return !isEnvironmentDetailsBlock
			}
			return true
		})

		// Add environment details as its own text block
		const finalUserContent = [...contentWithoutEnvDetails, { type: "text" as const, text: environmentDetails }]

		// Only add user message to conversation history if appropriate
		const isEmptyUserContent = currentUserContent.length === 0
		const shouldAddUserMessage =
			((currentItem.retryAttempt ?? 0) === 0 && !isEmptyUserContent) || currentItem.userMessageWasRemoved
		if (shouldAddUserMessage) {
			await delegate.addToApiConversationHistory({
				role: "user",
				content: finalUserContent,
			})
			getTelemetryService().captureConversationMessage(task.taskId, "user")
		}

		// Update the placeholder api_req_started message
		const clineMessages = delegate.clineMessages
		const lastApiReqIndex = findLastIndex(
			clineMessages,
			(m: Record<string, unknown>) => m.say === "api_req_started",
		)
		clineMessages[lastApiReqIndex].text = JSON.stringify({
			apiProtocol,
		} satisfies ClineApiReqInfo)

		await delegate.saveClineMessages()
		await postStateToWebviewWithoutTaskHistory(delegate.providerRef.deref()!)

		// ── Main streaming block ─────────────────────────────────────────
		try {
			let cacheWriteTokens = 0
			let cacheReadTokens = 0
			let inputTokens = 0
			let outputTokens = 0
			let totalCost: number | undefined

			// Create the updateApiReqMsg closure bound to this request's state
			const makeUpdateApiReqMsg = () => {
				return (cancelReason?: ClineApiReqCancelReason, streamingFailedMessage?: string) => {
					updateApiReqMsg(
						task,
						{
							inputTokens,
							outputTokens,
							cacheWriteTokens,
							cacheReadTokens,
							totalCost,
							streamModelInfo: delegate.cachedStreamingModel?.info as Record<string, unknown>,
							lastApiReqIndex,
							clineMessages: clineMessages as Parameters<typeof updateApiReqMsg>[1]["clineMessages"],
						},
						cancelReason,
						streamingFailedMessage,
					)
				}
			}

			// Reset streaming state for each new API request
			resetStreamingState(task)

			await delegate.diffViewProvider.reset()

			// Cache model info once per API request
			const cachedStreamingModel = delegate.api.getModel() as { id: string; info: ModelInfo }
			task.cachedStreamingModel = cachedStreamingModel
			const streamModelInfo = cachedStreamingModel.info
			const cachedModelId = cachedStreamingModel.id

			diagnosticsManager.setCurrentAction(t("diagnostics:actions.apiRequest", { model: cachedModelId }))
			diagnosticsManager.log(`[API] Starting request to ${cachedModelId}`)
			postStateToWebviewWithoutTaskHistory(delegate.providerRef.deref()!)

			const apiStartTime = Date.now()
			console.log(`[DEBUG: TaskLoop#${task.taskId}] Phase: API Request Start (Model: ${cachedModelId})`)
			const stream = delegate.attemptApiRequest(currentItem.retryAttempt ?? 0, { skipProviderRateLimit: true })
			let assistantMessage = ""
			let reasoningMessage = ""
			const pendingGroundingSources: GroundingSource[] = []
			task.isStreaming = true

			// Phase 1: Initialize assistant message in MST for real-time observability
			const providerInstance = delegate.providerRef.deref()
			const chatStore = providerInstance?.chatStore
			if (chatStore) {
				const node = chatStore.nodes.get(task.taskId)
				if (node) {
					node.addApiMessage({
						id: task.instanceId + "_assistant",
						role: "assistant",
						content: [],
						ts: task.generateUniqueTs(),
					})
				}
			}

			try {
				const iterator = (stream as AsyncIterable<Record<string, unknown>>)[Symbol.asyncIterator]()

				// Helper to race iterator.next() with abort signal and timeout
				const nextChunkWithAbort = async (isFirstChunk: boolean = false) => {
					const nextPromise: Promise<IteratorResult<Record<string, unknown>>> = iterator.next()
					const promises: Promise<IteratorResult<Record<string, unknown>>>[] = [nextPromise]

					// If we have an abort controller, race it with the next chunk
					const abortPromise = createAbortPromise(task)
					if (abortPromise) {
						promises.push(abortPromise)
					}

					// For the first chunk, add a timeout to prevent indefinite hangs
					if (isFirstChunk) {
						const timeoutPromise = createFirstChunkTimeoutPromise(task, getTimerQueue())
						promises.push(timeoutPromise)
					}

					return await Promise.race(promises)
				}

				// Create chunk handlers
				const chunkState = {
					assistantMessage,
					reasoningMessage,
					pendingGroundingSources,
					inputTokens,
					outputTokens,
					cacheWriteTokens,
					cacheReadTokens,
					totalCost,
					streamModelInfo,
					lastApiReqIndex,
					clineMessages: clineMessages as Parameters<typeof createChunkHandlers>[1]["clineMessages"],
				}
				const chunkHandlers = createChunkHandlers(task, chunkState)

				let item = await nextChunkWithAbort(true)
				while (!item.done) {
					const chunk = item.value
					item = await nextChunkWithAbort(false)
					if (!chunk) {
						continue
					}

					const handler = chunkHandlers[chunk.type as keyof typeof chunkHandlers]
					if (handler) {
						await handler(chunk as Record<string, unknown> & ApiStreamChunk)
					}

					// Read back mutated state from the chunkState object
					// The chunk handlers modify state properties directly via the object reference.
					assistantMessage = chunkState.assistantMessage
					reasoningMessage = chunkState.reasoningMessage

					if (task.abort) {
						console.log(`aborting stream, this.abandoned = ${String(task.abandoned)}`)
						if (!task.abandoned) {
							const updateFn = makeUpdateApiReqMsg()
							await abortStream(task, "user_cancelled", undefined, updateFn)
						}
						break
					}

					if (task.didRejectTool) {
						assistantMessage += "\n\n[Response interrupted by user feedback]"
						break
					}

					if (task.didAlreadyUseTool) {
						assistantMessage +=
							"\n\n[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]"
						break
					}
				}

				diagnosticsManager.recordMetric(
					"API Request (" + cachedModelId + ")",
					Date.now() - apiStartTime,
					"success",
				)

				const currentTokens = {
					input: inputTokens,
					output: outputTokens,
					cacheWrite: cacheWriteTokens,
					cacheRead: cacheReadTokens,
					total: totalCost,
				}

				const assistantMsgContent = delegate.assistantMessageContent
				if (
					task.isWaitingForFirstChunk &&
					!assistantMessage &&
					!reasoningMessage &&
					!assistantMsgContent.length
				) {
					if (!task.abort) {
						throw new Error(t("common:errors.model_no_response"))
					}
				}

				// Start background usage collection
				const updateFn = makeUpdateApiReqMsg()
				drainStreamInBackground(task, iterator, item, currentTokens, streamModelInfo, updateFn).catch(
					(error: unknown) => {
						console.error("Background usage collection failed:", error)
					},
				)
			} catch (error: unknown) {
				// [TODO-LOG] Stream error
				const streamErrorMsg = `[TODO-LOG] [Task] Stream error (taskId: ${task.taskId}, error: ${error instanceof Error ? (error as Error).message : "unknown"})`
				console.log(streamErrorMsg)
				diagnosticsManager.log(streamErrorMsg, "error")

				if (!task.abandoned) {
					const cancelReason: ClineApiReqCancelReason = task.abort ? "user_cancelled" : "streaming_failed"
					const rawErrorMessage =
						error instanceof Error
							? ((error as Error).message ?? JSON.stringify(serializeError(error), null, 2))
							: JSON.stringify(serializeError(error), null, 2)
					const streamingFailedMessage = task.abort
						? undefined
						: `${t("common:interruption.streamTerminatedByProvider")}: ${rawErrorMessage}`

					const updateFn = makeUpdateApiReqMsg()
					await abortStream(task, cancelReason, streamingFailedMessage, updateFn)

					if (task.abort) {
						task.abortReason = cancelReason
						await delegate.abortTask()
					} else {
						console.error(
							`[Task#${task.taskId}.${task.instanceId}] Stream failed, will retry: ${streamingFailedMessage}`,
						)

						const stateForBackoff: Record<string, unknown> | undefined = await delegate.providerRef
							.deref()
							?.getState()
						if (stateForBackoff?.autoApprovalEnabled) {
							await delegate.backoffAndAnnounce(currentItem.retryAttempt ?? 0, error)

							if (task.abort) {
								console.log(
									`[Task#${task.taskId}.${task.instanceId}] Task aborted during mid-stream retry backoff`,
								)
								task.abortReason = "user_cancelled"
								await delegate.abortTask()
								break
							}
						}

						stack.push({
							userContent: currentUserContent,
							includeFileDetails: false,
							retryAttempt: (currentItem.retryAttempt ?? 0) + 1,
						})
						continue
					}
				}
			} finally {
				task.isStreaming = false
				task.currentRequestAbortController = undefined

				const streamStopMsg = `[TODO-LOG] [Task] Stream stop (taskId: ${task.taskId})`
				console.log(streamStopMsg)
				diagnosticsManager.log(streamStopMsg, "info")
			}

			// ── Post-stream processing ────────────────────────────────────
			if (task.abort || task.abandoned) {
				throw new Error(
					`[Jabberwock#recursivelyMakeRooRequests] task ${task.taskId}.${task.instanceId} aborted`,
				)
			}

			task.didCompleteReadingStream = true

			// Finalize any remaining streaming tool calls that weren't explicitly ended
			const finalizeEvents = NativeToolCallParser.finalizeRawChunks()
			for (const event of finalizeEvents) {
				if (event.type === "tool_call_end") {
					const finalToolUse = NativeToolCallParser.finalizeStreamingToolCall(event.id)
					const streamingToolCallIndices = delegate.streamingToolCallIndices
					const toolUseIndex = streamingToolCallIndices.get(event.id)

					if (finalToolUse) {
						;(finalToolUse as { id: string }).id = event.id
						const assistantMsgContentFinal = delegate.assistantMessageContent
						if (toolUseIndex !== undefined) {
							assistantMsgContentFinal[toolUseIndex] = finalToolUse as typeof finalToolUse &
								Record<string, unknown>
						}
						streamingToolCallIndices.delete(event.id)
						task.userMessageContentReady = false
						presentAssistantMessage(task)
					} else if (toolUseIndex !== undefined) {
						const assistantMsgContentFinal = delegate.assistantMessageContent
						const existingToolUse = assistantMsgContentFinal[toolUseIndex]
						if (existingToolUse && existingToolUse.type === "tool_use") {
							existingToolUse.partial = false
							;(existingToolUse as { id: string }).id = event.id
						}
						streamingToolCallIndices.delete(event.id)
						task.userMessageContentReady = false
						presentAssistantMessage(task)
					}
				}
			}

			// Capture partial blocks AFTER finalizeRawChunks() to avoid double-presentation
			const assistantMsgContentFinal = delegate.assistantMessageContent
			const partialBlocks = assistantMsgContentFinal.filter((block) => block.partial)
			partialBlocks.forEach((block) => (block.partial = false))

			// Complete the reasoning message if it exists
			if (reasoningMessage) {
				const lastReasoningIndex = findLastIndex(
					clineMessages,
					(m: Record<string, unknown>) => m.type === "say" && m.say === "reasoning",
				)
				if (lastReasoningIndex !== -1 && clineMessages[lastReasoningIndex].partial) {
					clineMessages[lastReasoningIndex].partial = false
					await delegate.updateClineMessage(clineMessages[lastReasoningIndex])
				}
			}

			await delegate.saveClineMessages()
			await postStateToWebviewWithoutTaskHistory(delegate.providerRef.deref()!)

			// Check if we have any content to process (text or tool uses)
			const hasTextContent = assistantMessage.length > 0
			const hasToolUses = assistantMsgContentFinal.some(
				(block: Record<string, unknown>) => block.type === "tool_use" || block.type === "mcp_tool_use",
			)

			if (hasTextContent || hasToolUses) {
				// Reset counter when we get a successful response with content
				task.consecutiveNoAssistantMessagesCount = 0

				// Display grounding sources to the user if they exist
				if (pendingGroundingSources.length > 0) {
					const citationLinks = pendingGroundingSources.map(
						(source: GroundingSource, i: number) => `[${i + 1}](${source.url})`,
					)
					const sourcesText = `${t("common:gemini.sources")} ${citationLinks.join(", ")}`
					await task.say("text", sourcesText, undefined, false, undefined, undefined, {
						isNonInteractive: true,
					})
				}

				// Build the assistant message content array
				const assistantContent = buildAssistantContentForApi(task, assistantMessage)

				// Enforce new_task isolation
				enforceNewTaskIsolation(task, assistantContent)

				// Save assistant message BEFORE executing tools
				await saveAssistantMessageToHistory(task, assistantContent, reasoningMessage)
			}

			// Present any partial blocks that were just completed
			if (partialBlocks.length > 0) {
				if (assistantMsgContentFinal.length > 0) {
					console.log(
						`[DEBUG: TaskLoop#${task.taskId}] Phase: Tool Execution Start (Blocks: ${String(assistantMsgContentFinal.length)})`,
					)
					presentAssistantMessage(task)
				}
			}

			if (hasTextContent || hasToolUses) {
				// Wait for tool execution and prepare next content
				const nextUserContent = await waitForToolExecutionAndPrepareNextContent(task, assistantMessage)

				if (nextUserContent) {
					stack.push({
						userContent: nextUserContent,
						includeFileDetails: false,
					})

					// Add periodic yielding to prevent blocking
					await new Promise((resolve) => setImmediate(resolve))
				}

				continue
			} else {
				// No assistant responses - empty response from API
				task.consecutiveNoAssistantMessagesCount = task.consecutiveNoAssistantMessagesCount + 1

				if (task.consecutiveNoAssistantMessagesCount >= 2) {
					await task.say("error", "MODEL_NO_ASSISTANT_MESSAGES")
				}

				// Remove the user message we added earlier to avoid consecutive user messages
				const apiConversationHistory = delegate.apiConversationHistory
				if (apiConversationHistory.length > 0) {
					const lastMessage = apiConversationHistory[apiConversationHistory.length - 1]
					if (lastMessage.role === "user") {
						apiConversationHistory.pop()
					}
				}

				let stateForRetry: Record<string, unknown> | undefined = await delegate.providerRef.deref()?.getState()
				if (stateForRetry?.autoApprovalEnabled) {
					await delegate.backoffAndAnnounce(
						currentItem.retryAttempt ?? 0,
						new Error(
							"Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
						),
					)

					if (task.abort) {
						console.log(
							`[Task#${task.taskId}.${task.instanceId}] Task aborted during empty-assistant retry backoff`,
						)
						break
					}

					stack.push({
						userContent: currentUserContent,
						includeFileDetails: false,
						retryAttempt: (currentItem.retryAttempt ?? 0) + 1,
						userMessageWasRemoved: true,
					})
					continue
				} else {
					const { response } = await task.ask(
						"api_req_failed",
						"The model returned no assistant messages. This may indicate an issue with the API or the model's output.",
					)

					if (response === "yesButtonClicked") {
						await task.say("api_req_retried")
						stack.push({
							userContent: currentUserContent,
							includeFileDetails: false,
							retryAttempt: (currentItem.retryAttempt ?? 0) + 1,
						})
						continue
					} else {
						await delegate.addToApiConversationHistory({
							role: "user",
							content: currentUserContent,
						})
						await task.say(
							"error",
							"Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
						)
						await delegate.addToApiConversationHistory({
							role: "assistant",
							content: [{ type: "text", text: "Failure: I did not provide a response." }],
						})
					}
				}

				return false
			}
		} catch (error) {
			return true // Needs to be true so parent loop knows to end task
		}
	}

	return false
}
