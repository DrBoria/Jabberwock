import { Anthropic } from "@anthropic-ai/sdk"
import { serializeError } from "serialize-error"

import {
	type ClineApiReqCancelReason,
	type ClineApiReqInfo,
	getApiProtocol,
	getModelId,
	isRetiredProvider,
	ConsecutiveMistakeError,
} from "@jabberwock/types"
import { TelemetryService } from "@jabberwock/telemetry"

import { GroundingSource } from "../../../../../api/transform/stream"
import { findLastIndex } from "../../../../../shared/array"
import { t } from "../../../../../i18n"
import { formatResponse } from "../../../../prompts/responses"
import { defaultModeSlug, getModeBySlug } from "../../../../../shared/modes"

import { Task, getTimerQueue } from "../../../../task/Task"
import { presentAssistantMessage } from "../../../../assistant-message"
import { NativeToolCallParser } from "../../../../assistant-message/NativeToolCallParser"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getEnvironmentDetails } from "../../../../environment/getEnvironmentDetails"
import { processUserContentMentions } from "../../../../mentions/processUserContentMentions"

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
	const tsk = task as any
	const stack: StackItem[] = [{ userContent, includeFileDetails, retryAttempt: 0 }]

	while (stack.length > 0) {
		const currentItem = stack.pop()!
		const currentUserContent = currentItem.userContent
		const currentIncludeFileDetails = currentItem.includeFileDetails

		if (task.abort || tsk.turnResetPending) {
			throw new Error(
				`[Jabberwock#recursivelyMakeRooRequests] task ${task.taskId}.${task.instanceId} aborted or resetPending`,
			)
		}

		// ── Mistake limit check ──────────────────────────────────────────
		if (tsk.consecutiveMistakeLimit > 0 && tsk.consecutiveMistakeCount >= tsk.consecutiveMistakeLimit) {
			TelemetryService.instance.captureConsecutiveMistakeError(task.taskId)
			TelemetryService.instance.captureException(
				new ConsecutiveMistakeError(
					`Task reached consecutive mistake limit (${tsk.consecutiveMistakeLimit})`,
					task.taskId,
					tsk.consecutiveMistakeCount,
					tsk.consecutiveMistakeLimit,
					"no_tools_used",
					tsk.apiConfiguration.apiProvider,
					getModelId(tsk.apiConfiguration),
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

			tsk.consecutiveMistakeCount = 0
		}

		// ── API protocol & rate limiting ─────────────────────────────────
		const modelId = getModelId(tsk.apiConfiguration)
		const apiProvider = tsk.apiConfiguration.apiProvider
		const apiProtocol = getApiProtocol(
			apiProvider && !isRetiredProvider(apiProvider) ? apiProvider : undefined,
			modelId,
		)

		await tsk.maybeWaitForProviderRateLimit(currentItem.retryAttempt ?? 0)
		;(Task as any).lastGlobalApiRequestTime = performance.now()

		await task.say("api_req_started", JSON.stringify({ apiProtocol }))

		// [TODO-LOG] Stream start
		const todoLogMsg = `[TODO-LOG] [Task] Stream start (taskId: ${task.taskId}, model: ${modelId})`
		console.log(todoLogMsg)
		diagnosticsManager.log(todoLogMsg, "info")
		const provider = tsk.providerRef.deref()
		const state = provider ? await provider.getState() : undefined

		const showJabberwockIgnoredFiles = state?.showJabberwockIgnoredFiles ?? false
		const includeDiagnosticMessages = state?.includeDiagnosticMessages ?? true
		const maxDiagnosticMessages = state?.maxDiagnosticMessages ?? 50
		const currentMode = state?.mode ?? defaultModeSlug

		// ── Process user content mentions ────────────────────────────────
		const { content: parsedUserContent, mode: slashCommandMode } = await processUserContentMentions({
			userContent: currentUserContent,
			cwd: task.cwd,
			fileContextTracker: tsk.fileContextTracker,
			jabberwockIgnoreController: tsk.jabberwockIgnoreController,
			showJabberwockIgnoredFiles,
			includeDiagnosticMessages,
			maxDiagnosticMessages,
			skillsManager: provider?.getSkillsManager(),
			currentMode,
		})

		// Switch mode if specified in a slash command's frontmatter
		if (slashCommandMode) {
			const providerRef = tsk.providerRef.deref()
			if (providerRef) {
				const providerState = await providerRef.getState()
				const targetMode = getModeBySlug(slashCommandMode, providerState?.customModes)
				if (targetMode) {
					await providerRef.handleModeSwitch(slashCommandMode)
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
		const contentWithoutEnvDetails = parsedUserContent.filter((block: any) => {
			if (block.type === "text" && typeof block.text === "string") {
				const isEnvironmentDetailsBlock =
					block.text.trim().startsWith("<environment_details>") &&
					block.text.trim().endsWith("</environment_details>")
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
			await tsk.addToApiConversationHistory({ role: "user", content: finalUserContent })
			TelemetryService.instance.captureConversationMessage(task.taskId, "user")
		}

		// Update the placeholder api_req_started message
		const lastApiReqIndex = findLastIndex(tsk.clineMessages, (m: any) => m.say === "api_req_started")
		tsk.clineMessages[lastApiReqIndex].text = JSON.stringify({
			apiProtocol,
		} satisfies ClineApiReqInfo)

		await tsk.saveClineMessages()
		await tsk.providerRef.deref()?.postStateToWebviewWithoutTaskHistory()

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
							streamModelInfo: tsk.cachedStreamingModel?.info,
							lastApiReqIndex,
							clineMessages: tsk.clineMessages,
						},
						cancelReason,
						streamingFailedMessage,
					)
				}
			}

			// Reset streaming state for each new API request
			resetStreamingState(task)

			await tsk.diffViewProvider.reset()

			// Cache model info once per API request
			tsk.cachedStreamingModel = tsk.api.getModel()
			const streamModelInfo = tsk.cachedStreamingModel.info
			const cachedModelId = tsk.cachedStreamingModel.id

			diagnosticsManager.setCurrentAction(t("diagnostics:actions.apiRequest", { model: cachedModelId }))
			diagnosticsManager.log(`[API] Starting request to ${cachedModelId}`)
			tsk.providerRef.deref()?.postDiagnosticsToWebviewThrottled()

			const apiStartTime = Date.now()
			console.log(`[DEBUG: TaskLoop#${task.taskId}] Phase: API Request Start (Model: ${cachedModelId})`)
			const stream = tsk.attemptApiRequest(currentItem.retryAttempt ?? 0, { skipProviderRateLimit: true })
			let assistantMessage = ""
			let reasoningMessage = ""
			const pendingGroundingSources: GroundingSource[] = []
			tsk.isStreaming = true

			// Phase 1: Initialize assistant message in MST for real-time observability
			const providerInstance = tsk.providerRef.deref()
			if (providerInstance && providerInstance.chatStore) {
				const node = providerInstance.chatStore.nodes.get(task.taskId)
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
				const iterator = stream[Symbol.asyncIterator]()

				// Helper to race iterator.next() with abort signal and timeout
				const nextChunkWithAbort = async (isFirstChunk: boolean = false) => {
					const nextPromise = iterator.next()
					const promises: Promise<any>[] = [nextPromise]

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
					clineMessages: tsk.clineMessages,
				}
				const chunkHandlers = createChunkHandlers(task, chunkState)

				let item = await nextChunkWithAbort(true)
				while (!item.done) {
					const chunk = item.value
					item = await nextChunkWithAbort(false)
					if (!chunk) {
						continue
					}

					const handler = chunkHandlers[chunk.type]
					if (handler) {
						await handler(chunk)
					}

					// Read back mutated state from the chunkState object
					// The chunk handlers modify state properties directly via the object reference.
					assistantMessage = chunkState.assistantMessage
					reasoningMessage = chunkState.reasoningMessage

					if (task.abort) {
						console.log(`aborting stream, this.abandoned = ${tsk.abandoned}`)
						if (!tsk.abandoned) {
							const updateFn = makeUpdateApiReqMsg()
							await abortStream(task, "user_cancelled", undefined, updateFn)
						}
						break
					}

					if (tsk.didRejectTool) {
						assistantMessage += "\n\n[Response interrupted by user feedback]"
						break
					}

					if (tsk.didAlreadyUseTool) {
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

				if (
					tsk.isWaitingForFirstChunk &&
					!assistantMessage &&
					!reasoningMessage &&
					!tsk.assistantMessageContent.length
				) {
					if (!task.abort) {
						throw new Error(t("common:errors.model_no_response"))
					}
				}

				// Start background usage collection
				const updateFn = makeUpdateApiReqMsg()
				drainStreamInBackground(task, iterator, item, currentTokens, streamModelInfo, updateFn).catch(
					(error: any) => {
						console.error("Background usage collection failed:", error)
					},
				)
			} catch (error: any) {
				// [TODO-LOG] Stream error
				const streamErrorMsg = `[TODO-LOG] [Task] Stream error (taskId: ${task.taskId}, error: ${error?.message ?? "unknown"})`
				console.log(streamErrorMsg)
				diagnosticsManager.log(streamErrorMsg, "error")

				if (!tsk.abandoned) {
					const cancelReason: ClineApiReqCancelReason = task.abort ? "user_cancelled" : "streaming_failed"
					const rawErrorMessage = error.message ?? JSON.stringify(serializeError(error), null, 2)
					const streamingFailedMessage = task.abort
						? undefined
						: `${t("common:interruption.streamTerminatedByProvider")}: ${rawErrorMessage}`

					const updateFn = makeUpdateApiReqMsg()
					await abortStream(task, cancelReason, streamingFailedMessage, updateFn)

					if (task.abort) {
						tsk.abortReason = cancelReason
						await tsk.abortTask()
					} else {
						console.error(
							`[Task#${task.taskId}.${task.instanceId}] Stream failed, will retry: ${streamingFailedMessage}`,
						)

						const stateForBackoff = await tsk.providerRef.deref()?.getState()
						if (stateForBackoff?.autoApprovalEnabled) {
							await tsk.backoffAndAnnounce(currentItem.retryAttempt ?? 0, error)

							if (task.abort) {
								console.log(
									`[Task#${task.taskId}.${task.instanceId}] Task aborted during mid-stream retry backoff`,
								)
								tsk.abortReason = "user_cancelled"
								await tsk.abortTask()
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
				tsk.isStreaming = false
				tsk.currentRequestAbortController = undefined

				const streamStopMsg = `[TODO-LOG] [Task] Stream stop (taskId: ${task.taskId})`
				console.log(streamStopMsg)
				diagnosticsManager.log(streamStopMsg, "info")
			}

			// ── Post-stream processing ────────────────────────────────────
			if (task.abort || tsk.abandoned) {
				throw new Error(
					`[Jabberwock#recursivelyMakeRooRequests] task ${task.taskId}.${task.instanceId} aborted`,
				)
			}

			tsk.didCompleteReadingStream = true

			// Finalize any remaining streaming tool calls that weren't explicitly ended
			const finalizeEvents = NativeToolCallParser.finalizeRawChunks()
			for (const event of finalizeEvents) {
				if (event.type === "tool_call_end") {
					const finalToolUse = NativeToolCallParser.finalizeStreamingToolCall(event.id)
					const toolUseIndex = tsk.streamingToolCallIndices.get(event.id)

					if (finalToolUse) {
						;(finalToolUse as any).id = event.id
						if (toolUseIndex !== undefined) {
							tsk.assistantMessageContent[toolUseIndex] = finalToolUse
						}
						tsk.streamingToolCallIndices.delete(event.id)
						tsk.userMessageContentReady = false
						presentAssistantMessage(task)
					} else if (toolUseIndex !== undefined) {
						const existingToolUse = tsk.assistantMessageContent[toolUseIndex]
						if (existingToolUse && existingToolUse.type === "tool_use") {
							existingToolUse.partial = false
							;(existingToolUse as any).id = event.id
						}
						tsk.streamingToolCallIndices.delete(event.id)
						tsk.userMessageContentReady = false
						presentAssistantMessage(task)
					}
				}
			}

			// Capture partial blocks AFTER finalizeRawChunks() to avoid double-presentation
			const partialBlocks = tsk.assistantMessageContent.filter((block: any) => block.partial)
			partialBlocks.forEach((block: any) => (block.partial = false))

			// Complete the reasoning message if it exists
			if (reasoningMessage) {
				const lastReasoningIndex = findLastIndex(
					tsk.clineMessages,
					(m: any) => m.type === "say" && m.say === "reasoning",
				)
				if (lastReasoningIndex !== -1 && tsk.clineMessages[lastReasoningIndex].partial) {
					tsk.clineMessages[lastReasoningIndex].partial = false
					await tsk.updateClineMessage(tsk.clineMessages[lastReasoningIndex])
				}
			}

			await tsk.saveClineMessages()
			await tsk.providerRef.deref()?.postStateToWebviewWithoutTaskHistory()

			// Check if we have any content to process (text or tool uses)
			const hasTextContent = assistantMessage.length > 0
			const hasToolUses = tsk.assistantMessageContent.some(
				(block: any) => block.type === "tool_use" || block.type === "mcp_tool_use",
			)

			if (hasTextContent || hasToolUses) {
				// Reset counter when we get a successful response with content
				tsk.consecutiveNoAssistantMessagesCount = 0

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
				if (tsk.assistantMessageContent.length > 0) {
					console.log(
						`[DEBUG: TaskLoop#${task.taskId}] Phase: Tool Execution Start (Blocks: ${tsk.assistantMessageContent.length})`,
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
				tsk.consecutiveNoAssistantMessagesCount++

				if (tsk.consecutiveNoAssistantMessagesCount >= 2) {
					await task.say("error", "MODEL_NO_ASSISTANT_MESSAGES")
				}

				// Remove the user message we added earlier to avoid consecutive user messages
				if (tsk.apiConversationHistory.length > 0) {
					const lastMessage = tsk.apiConversationHistory[tsk.apiConversationHistory.length - 1]
					if (lastMessage.role === "user") {
						tsk.apiConversationHistory.pop()
					}
				}

				let stateForRetry = await tsk.providerRef.deref()?.getState()
				if (stateForRetry?.autoApprovalEnabled) {
					await tsk.backoffAndAnnounce(
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
						await tsk.addToApiConversationHistory({
							role: "user",
							content: currentUserContent,
						})
						await task.say(
							"error",
							"Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
						)
						await tsk.addToApiConversationHistory({
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
