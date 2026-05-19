import {
	type ClineApiReqCancelReason,
	type ModelInfo,
	getApiProtocol,
	getModelId,
	isRetiredProvider,
} from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"

import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../../../../shared/cost"
import { t } from "../../../../i18n"
import { Task } from "../Task"
import { NativeToolCallParser } from "../../../../core/assistant-message/NativeToolCallParser"

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
export function createAbortPromise(task: Task): Promise<never> | null {
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
export function createFirstChunkTimeoutPromise(task: Task, timerQueue: Record<string, unknown>): Promise<never> {
	const FIRST_CHUNK_TIMEOUT_MS = 300_000 // 5 minutes (local models can be slow to load)
	const timeoutId = (timerQueue.schedule as (opts: Record<string, unknown>) => string)({
		id: `first-chunk-timeout-${task.taskId}`,
		label: "First chunk timeout",
		timeoutMs: FIRST_CHUNK_TIMEOUT_MS,
	})
	return (timerQueue.createTimeoutPromise as (id: string, msg: string) => Promise<never>)(
		timeoutId,
		t("common:errors.model_no_response"),
	)
}

/**
 * Aborts the current stream gracefully: reverts diff view, marks partial messages as complete,
 * updates the API request message with cancellation reason, and signals completion.
 */
export async function abortStream(
	task: Task,
	cancelReason: ClineApiReqCancelReason,
	streamingFailedMessage?: string,
	updateApiReqMsg?: (cancelReason?: ClineApiReqCancelReason, streamingFailedMessage?: string) => void,
): Promise<void> {
	const diffViewProvider = task.diffViewProvider
	if (diffViewProvider.isEditing) {
		await diffViewProvider.revertChanges() // closes diff view
	}

	// if last message is a partial we need to update and save it
	const clineMessages = task.clineMessages
	const lastMessage = clineMessages.at(-1)

	if (lastMessage && lastMessage.partial) {
		lastMessage.partial = false
	}

	// Update `api_req_started` to have cancelled and cost, so that
	// we can display the cost of the partial stream and the cancellation reason
	if (updateApiReqMsg) {
		updateApiReqMsg(cancelReason, streamingFailedMessage)
	}
	await task.saveClineMessages()

	// Signals to provider that it can retrieve the saved messages
	// from disk, as abortTask can not be awaited on in nature.
	task.didFinishAbortingStream = true
}

/**
 * Resets streaming state for each new API request.
 * Clears all content buffers, flags, and tool call parsers.
 */
export function resetStreamingState(task: Task): void {
	task.currentStreamingContentIndex = 0
	task.currentStreamingDidCheckpoint = false
	task.assistantMessageContent = []
	task.didCompleteReadingStream = false
	task.userMessageContent = []
	task.userMessageContentReady = false
	task.didRejectTool = false
	task.didAlreadyUseTool = false
	task.assistantMessageSavedToHistory = false
	// Reset tool failure flag for each new assistant turn - this ensures that tool failures
	// only prevent attempt_completion within the same assistant message, not across turns
	// (e.g., if a tool fails, then user sends a message saying "just complete anyway")
	task.didToolFailInCurrentTurn = false
	task.presentAssistantMessageLocked = false
	task.presentAssistantMessageHasPendingUpdates = false
	// No legacy text-stream tool parser.
	task.streamingToolCallIndices.clear()
	// Clear any leftover streaming tool call state from previous interrupted streams
	NativeToolCallParser.clearAllStreamingToolCalls()
	NativeToolCallParser.clearRawChunkState()
}

/**
 * Drains the remaining stream in the background to collect usage data (token counts, cost).
 * This runs after the main stream loop has finished processing content chunks,
 * because some providers send usage data at the very end of the stream.
 *
 * @returns The accumulated token/cost data, or null if the stream was already exhausted.
 */
export async function drainStreamInBackground(
	task: Task,
	iterator: AsyncIterator<Record<string, unknown>>,
	item: IteratorResult<Record<string, unknown>>,
	currentTokens: {
		input: number
		output: number
		cacheWrite: number
		cacheRead: number
		total?: number
	},
	streamModelInfo: Record<string, unknown>,
	updateApiReqMsg: () => void,
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

			const chunk = item.value as Record<string, unknown>
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
		console.error(`[Background Usage Collection] Error: ${error}`)
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
	task: Task,
	tokens: {
		input: number
		output: number
		cacheWrite: number
		cacheRead: number
		total?: number
	},
	streamModelInfo: Record<string, unknown>,
	updateApiReqMsg: () => void,
): Promise<void> {
	if (tokens.input > 0 || tokens.output > 0 || tokens.cacheWrite > 0 || tokens.cacheRead > 0) {
		// Update the API request message with the latest usage data
		updateApiReqMsg()
		await task.saveClineMessages()

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
