import { type CancelReason } from "@jabberwock/types"
import { t } from "@i18n"
import type { StreamHandle } from "@features/chat/task/condense/actions/types"
import { captureUsageData } from "./captureUsage"
import { RawChunkTracker } from "@features/api/handlers/helpers/process/rawChunkProcessor"
import type { IBackendRootStore } from "@features/store"
import { getDiffViewProvider } from "@features/foundation/time-machine/actions/getTimeMachine"

const DEFAULT_USAGE_COLLECTION_TIMEOUT_MS = 5000

/**
 * Creates an abort promise that rejects when the user cancels the current request.
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
 */
export function createFirstChunkTimeoutPromise(task: StreamHandle): Promise<never> {
	const FIRST_CHUNK_TIMEOUT_MS = 300_000
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
		await diffViewProvider.revertChanges()
	}

	const messages = task.messages
	const lastMessage = messages.at(-1)

	if (lastMessage && lastMessage.partial) {
		lastMessage.partial = false
	}

	if (updateApiReqMsg) {
		updateApiReqMsg(cancelReason, streamingFailedMessage)
	}
	await saveMessages?.()

	task._state.setDidFinishAbortingStream(true)
}

/**
 * Resets streaming state for each new API request.
 */
export function resetStreamingState(
	task: StreamHandle,
	store: IBackendRootStore,
	rawChunkTracker: RawChunkTracker,
): void {
	task._state.setCurrentStreamingContentIndex(0)
	task._state.setCurrentStreamingDidCheckpoint(false)
	task.assistantMessageContent.splice(0)
	task._state.setDidCompleteReadingStream(false)
	task.userMessageContent.splice(0)
	task._state.setUserMessageContentReady(false)
	task._state.setDidRejectTool(false)
	task._state.setDidAlreadyUseTool(false)
	task._state.setAssistantMessageSavedToHistory(false)
	task._state.setDidToolFailInCurrentTurn(false)
	task._state.setPresentAssistantMessageLocked(false)
	task._state.setPresentAssistantMessageHasPendingUpdates(false)
	task._state.resetStreamingToolCallIndices()
	store.chat.clearAllStreamingToolCalls()
	task.clearPartialMessage()
	rawChunkTracker.clear()
}

/**
 * Drains the remaining stream in the background to collect usage data (token counts, cost).
 * This runs after the main stream loop has finished processing content chunks,
 * because some providers send usage data at the very end of the stream.
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

	let bgInputTokens = currentTokens.input
	let bgOutputTokens = currentTokens.output
	let bgCacheWriteTokens = currentTokens.cacheWrite
	let bgCacheReadTokens = currentTokens.cacheRead
	let bgTotalCost = currentTokens.total

	try {
		let usageFound = false
		let chunkCount = 0

		while (!item.done) {
			if (performance.now() - startTime > timeoutMs) {
				console.warn(
					`[Background Usage Collection] Timed out after ${timeoutMs}ms, processed ${chunkCount} chunks`,
				)
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
