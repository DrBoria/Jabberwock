import { type CancelReason, type ModelInfo, getApiProtocol, getModelId, isRetiredProvider } from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../../../../shared/cost"
import { t } from "../../../../i18n"
import type { StreamHandle } from "../../../chat/task/condense/actions/types"
import { RawChunkTracker } from "./rawChunkProcessor"
import type { IBackendRootStore } from "../../../store"
import { getDiffViewProvider } from "../../../foundation/time-machine/actions/getTimeMachine"

/**
 * Default timeout for background usage collection after the main stream loop finishes.
 * This gives the stream a chance to deliver remaining usage chunks (e.g., from providers
 * that send usage data at the end of the stream).
 */
const DEFAULT_USAGE_COLLECTION_TIMEOUT_MS = 5000 // 5 seconds

/**
 * Creates an abort promise that rejects when the user cancels the current request.
 * Used to race against stream iteration for immediate cancellation.
 */
export function createAbortPromise(task: StreamHandle): Promise<never> | null {
	const controller = task.currentRequestAbortController
	if (!controller) {
		return null
	}

	return new Promise<never>((_, reject) => {
		const signal = controller.signal
		if (signal.aborted) {
			reject(new Error("Request cancelled by user"))
		} else {
			signal.addEventListener("abort", () => {
				reject(new Error("Request cancelled by user"))
			})
		}
	})
}

/**
 * Creates a timeout promise for the first chunk of a stream.
 * This prevents indefinite hangs (e.g., Ollama/OpenRouter issues loading models).
 */
export function createFirstChunkTimeoutPromise(task: StreamHandle): Promise<never> {
	const FIRST_CHUNK_TIMEOUT_MS = 300_000 // 5 minutes (local models can be slow to load)
	return new Promise<never>((_, reject) => {
		setTimeout(() => reject(new Error(t("common:errors.model_no_response"))), FIRST_CHUNK_TIMEOUT_MS)
	})
}

/**
 * Aborts the current stream gracefully: reverts diff view, marks partial messages as complete,
 * updates the API request message with cancellation reason, and signals completion.
 */
export async function abortStream(
	task: StreamHandle,
	cancelReason: CancelReason,
	streamingFailedMessage?: string,
	updateApiReqMsg?: (cancelReason?: CancelReason, streamingFailedMessage?: string) => void,
	saveMessages?: () => Promise<unknown>,
): Promise<void> {
	const diffViewProvider = getDiffViewProvider()
	if (diffViewProvider.isEditing) {
		await diffViewProvider.revertChanges() // closes diff view
	}

	// if last message is a partial we need to update and save it
	const messages = task.messages
	const lastMessage = messages.at(-1)

	if (lastMessage && lastMessage.partial) {
		lastMessage.partial = false
	}

	// Update `api_req_started` to have cancelled and cost, so that
	// we can display the cost of the partial stream and the cancellation reason
	if (updateApiReqMsg) {
		updateApiReqMsg(cancelReason, streamingFailedMessage)
	}
	await saveMessages?.()

	// Signals to provider that it can retrieve the saved messages
	// from disk, as abortTask can not be awaited on in nature.
	task._state.setDidFinishAbortingStream(true)
}

/**
 * Resets streaming state for each new API request.
 * Clears all content buffers, flags, and tool call parsers.
 */
export function resetStreamingState(
	task: StreamHandle,
	store: IBackendRootStore,
	rawChunkTracker: RawChunkTracker,
): void {
	task._state.setCurrentStreamingContentIndex(0)
	task._state.setCurrentStreamingDidCheckpoint(false)
	task.assistantMessageContent = []
	task._state.setDidCompleteReadingStream(false)
	task.userMessageContent = []
	task._state.setUserMessageContentReady(false)
	task._state.setDidRejectTool(false)
	task._state.setDidAlreadyUseTool(false)
	task._state.setAssistantMessageSavedToHistory(false)
	// Reset tool failure flag for each new assistant turn - this ensures that tool failures
	// only prevent attempt_completion within the same assistant message, not across turns
	// (e.g., if a tool fails, then user sends a message saying "just complete anyway")
	task._state.setDidToolFailInCurrentTurn(false)
	task._state.setPresentAssistantMessageLocked(false)
	task._state.setPresentAssistantMessageHasPendingUpdates(false)
	// No legacy text-stream tool parser.
	// Clear streaming tool call indices
	task._state.resetStreamingToolCallIndices()
	// Clear any leftover streaming tool call state from previous interrupted streams
	store.chat.clearAllStreamingToolCalls()
	rawChunkTracker.clear()
}

/**
 * Drains the remaining stream in the background to collect usage data (token counts, cost).
 * This runs after the main stream loop has finished processing content chunks,
 * because some providers send usage data at the very end of the stream.
 *
 * @returns The accumulated token/cost data, or null if the stream was already exhausted.
 */
export async function drainStreamInBackground(
	task: StreamHandle,
	iterator: AsyncIterator<{ [key: string]: unknown }>,
	item: IteratorResult<{ [key: string]: unknown }>,
	currentTokens: {
		input: number
		output: number
		cacheWrite: number
		cacheRead: number
		total?: number
	},
	streamModelInfo: { [key: string]: unknown },
	updateApiReqMsg: () => void,
	saveMessages?: () => Promise<unknown>,
): Promise<{
	input: number
	output: number
	cacheWrite: number
	cacheRead: number
	total?: number
} | null> {
	const timeoutMs = DEFAULT_USAGE_COLLECTION_TIMEOUT_MS
	const startTime = performance.now()

	// Local variables to accumulate usage data without affecting the main flow
	let bgInputTokens = currentTokens.input
	let bgOutputTokens = currentTokens.output
	let bgCacheWriteTokens = currentTokens.cacheWrite
	let bgCacheReadTokens = currentTokens.cacheRead
	let bgTotalCost = currentTokens.total

	try {
		// Continue processing the original stream from where the main loop left off
		let usageFound = false
		let chunkCount = 0

		// Use the same iterator that the main loop was using
		while (!item.done) {
			// Check for timeout
			if (performance.now() - startTime > timeoutMs) {
				console.warn(
					`[Background Usage Collection] Timed out after ${timeoutMs}ms, processed ${chunkCount} chunks`,
				)
				// Clean up the iterator before breaking
				if (iterator.return) {
					await iterator.return(undefined)
				}
				break
			}

			const chunk = item.value as { [key: string]: unknown }
			item = await iterator.next()
			chunkCount++

			if (!chunk) {
				continue
			}

			if (chunk.type === "usage") {
				usageFound = true
				bgInputTokens += chunk.inputTokens as number
				bgOutputTokens += chunk.outputTokens as number
				bgCacheWriteTokens += (chunk.cacheWriteTokens ?? 0) as number
				bgCacheReadTokens += (chunk.cacheReadTokens ?? 0) as number
				bgTotalCost = chunk.totalCost as number | undefined

				// Update the shared variables atomically
				await captureUsageData(
					task,
					{
						input: bgInputTokens,
						output: bgOutputTokens,
						cacheWrite: bgCacheWriteTokens,
						cacheRead: bgCacheReadTokens,
						total: bgTotalCost,
					},
					streamModelInfo,
					updateApiReqMsg,
					saveMessages,
				)
			}
		}

		if (usageFound) {
			console.log(
				`[Background Usage Collection] Found usage data after processing ${chunkCount} chunks. ` +
					`Tokens: in=${bgInputTokens} out=${bgOutputTokens} cacheW=${bgCacheWriteTokens} cacheR=${bgCacheReadTokens}`,
			)
		} else {
			console.log(
				`[Background Usage Collection] No usage data found after ${chunkCount} chunks (${performance.now() - startTime}ms)`,
			)
		}
	} catch (error) {
		console.error(`[jabberwock] [Background Usage Collection] Error: ${error}`)
	}

	return {
		input: bgInputTokens,
		output: bgOutputTokens,
		cacheWrite: bgCacheWriteTokens,
		cacheRead: bgCacheReadTokens,
		total: bgTotalCost,
	}
}

/**
 * Captures usage data (token counts, cost) and updates telemetry and the API request message.
 */
async function captureUsageData(
	task: StreamHandle,
	tokens: {
		input: number
		output: number
		cacheWrite: number
		cacheRead: number
		total?: number
	},
	streamModelInfo: { [key: string]: unknown },
	updateApiReqMsg: () => void,
	saveMessages?: () => Promise<unknown>,
): Promise<void> {
	if (tokens.input > 0 || tokens.output > 0 || tokens.cacheWrite > 0 || tokens.cacheRead > 0) {
		// Update the API request message with the latest usage data
		updateApiReqMsg()
		await saveMessages?.()

		// Capture telemetry with provider-aware cost calculation
		const modelId = getModelId(task.apiConfiguration)
		const apiProvider = task.apiConfiguration.apiProvider
		const apiProtocol = getApiProtocol(
			apiProvider && !isRetiredProvider(apiProvider) ? apiProvider : undefined,
			modelId,
		)

		// Use the appropriate cost function based on the API protocol
		const costResult =
			apiProtocol === "anthropic"
				? calculateApiCostAnthropic(
						streamModelInfo as ModelInfo,
						tokens.input,
						tokens.output,
						tokens.cacheWrite,
						tokens.cacheRead,
					)
				: calculateApiCostOpenAI(
						streamModelInfo as ModelInfo,
						tokens.input,
						tokens.output,
						tokens.cacheWrite,
						tokens.cacheRead,
					)

		getTelemetryService().captureLlmCompletion(task.taskId, {
			inputTokens: costResult.totalInputTokens,
			outputTokens: costResult.totalOutputTokens,
			cacheWriteTokens: tokens.cacheWrite,
			cacheReadTokens: tokens.cacheRead,
			cost: tokens.total ?? costResult.totalCost,
		})
	}
}
