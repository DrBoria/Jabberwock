import { serializeError } from "serialize-error"

import { type CancelReason, type Notification, type ModelInfo, IntentType, IntentStatus } from "@jabberwock/types"

import { GroundingSource, type ApiStreamChunk } from "../../../../api/transform/stream"
import { t } from "../../../../i18n"

import type { ITaskModel } from "../../../chat/task/store"
import type { StreamHandle } from "../../../chat/task/condense/actions/types"
import type { AssistantMessageContent } from "../../../chat/task/messages/actions/types"

import { presentAssistantMessage } from "../../../chat/task/messages/actions"
import { getDiffViewProvider } from "../../../foundation/time-machine/actions/getTimeMachine"
import { diagnosticsManager } from "@jabberwock/devtool"

import { RawChunkTracker } from "./rawChunkProcessor"
import { createChunkHandlers, updateApiReqMsg } from "./streamChunkHandlers"
import {
	createAbortPromise,
	createFirstChunkTimeoutPromise,
	abortStream,
	resetStreamingState,
	drainStreamInBackground,
} from "./requestAbortManager"
import { postStateToWebviewWithoutTaskHistory } from "@features/foundation/window-manager/store"
import { systemBroadcast } from "../../../chat/task/messages/actions/say"
import { saveMessages } from "../../../chat/task/messages/actions/persistMessages"

import { type ApiRequestContext } from "./prepareApiRequest"
import { IntentConstants } from "@intentConstants"
import type { ToolProgressStatus, ContextCondense, ContextTruncation, NotificationSay } from "@jabberwock/types"
import type { CheckpointData } from "../../../chat/task/messages/actions/say/emitBroadcast"
import { sendStreamChunk } from "../../events/actions"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StreamResult {
	taskId: string
	assistantMessage: string
	reasoningMessage: string
	pendingGroundingSources: GroundingSource[]
	inputTokens: number
	outputTokens: number
	cacheWriteTokens: number
	cacheReadTokens: number
	totalCost: number | undefined
	lastApiReqIndex: number
	messages: Notification[]
	assistantMsgContent: AssistantMessageContent[]
	chunkState: { [key: string]: unknown }
	/** Per-stream tracker owned by this handleStream call — passed to finalizeToolCalls. */
	rawChunkTracker: RawChunkTracker
}

// ── E.3: handleStream ──────────────────────────────────────────────────────────

/**
 * Handles the streaming API request for a prepared context.
 *
 * 2-INTENT STREAMING PATTERN:
 * 1. Before stream: dispatches STREAMING_STARTED intent → handler creates AgentMessage(text: "") in MST
 * 2. During stream: text chunks accumulated in buffer + sent via sendStreamChunk (direct postMessage exception)
 * 3. After stream: dispatches STREAMING_ENDED intent → handler sets final text + finishReason
 *
 * Keeps orchestration logic (retry, rate limiting, abort/timeout racing).
 * Tool calls, reasoning, grounding, and usage still go through chunk handlers.
 */
/** Typed helper to access StreamHandle properties on an ITaskModel without as-unknown. */
function toStreamHandle(task: ITaskModel): StreamHandle {
	return task as ITaskModel & StreamHandle
}

export async function handleStream(ctx: ApiRequestContext): Promise<StreamResult | null> {
	const { task, delegate, store } = ctx
	const sh = toStreamHandle(task)

	let cacheWriteTokens = 0
	let cacheReadTokens = 0
	let inputTokens = 0
	let outputTokens = 0
	let totalCost: number | undefined

	// Text accumulation buffer for sendStreamChunk
	let accumulatedText = ""

	// Create the updateApiReqMsg closure bound to this request's state
	const makeUpdateApiReqMsg = () => {
		return (cancelReason?: CancelReason, streamingFailedMessage?: string) => {
			updateApiReqMsg(
				sh,
				{
					inputTokens,
					outputTokens,
					cacheWriteTokens,
					cacheReadTokens,
					totalCost,
					streamModelInfo: delegate.cachedStreamingModel?.info as { [key: string]: unknown },
					lastApiReqIndex: 0,
					messages: [...store.chat.tasks.get(ctx.taskId)!.notifications.items],
				},
				cancelReason,
				streamingFailedMessage,
			)
		}
	}

	// Create per-stream RawChunkTracker (replaces module-level singleton)
	const rawChunkTracker = new RawChunkTracker()

	// Reset streaming state for each new API request
	resetStreamingState(sh, store, rawChunkTracker)

	await getDiffViewProvider().reset()

	// Cache model info once per API request
	if (!delegate.api) {
		console.error(`[handleStream] delegate.api not set for task ${ctx.taskId}`)
		return null
	}
	const cachedStreamingModel = delegate.api.getModel() as { id: string; info: ModelInfo }
	task.cachedStreamingModel = cachedStreamingModel
	const streamModelInfo = cachedStreamingModel.info
	const cachedModelId = cachedStreamingModel.id

	diagnosticsManager.setCurrentAction(t("diagnostics:actions.apiRequest", { model: cachedModelId }))
	diagnosticsManager.log(`[API] Starting request to ${cachedModelId}`)

	// Dispatch STREAMING_STARTED intent — handler creates AgentMessage(text: "") in MST
	const provider = delegate.providerRef.deref()
	if (!provider) {
		console.error(`[handleStream] No provider for task ${ctx.taskId}`)
		return null
	}
	postStateToWebviewWithoutTaskHistory(provider)

	const intentStore = store.intentStore
	intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentConstants.api.STREAMING_STARTED,
		payload: {
			taskId: ctx.taskId,
			modelId: cachedModelId,
		},
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})

	const apiStartTime = Date.now()
	console.log(`[DEBUG: TaskLoop#${task.taskId}] Phase: API Request Start (Model: ${cachedModelId})`)
	const stream = delegate.attemptApiRequest(ctx.retryAttempt, { skipProviderRateLimit: true })
	let assistantMessage = ""
	let reasoningMessage = ""
	const pendingGroundingSources: GroundingSource[] = []
	task._state.setIsStreaming(true)

	try {
		const iterator = (stream as AsyncIterable<{ [key: string]: unknown }>)[Symbol.asyncIterator]()

		// Helper to race iterator.next() with abort signal and timeout
		const nextChunkWithAbort = async (isFirstChunk: boolean = false) => {
			const nextPromise: Promise<IteratorResult<{ [key: string]: unknown }>> = iterator.next()
			const promises: Promise<IteratorResult<{ [key: string]: unknown }>>[] = [nextPromise]

			// If we have an abort controller, race it with the next chunk
			const abortPromise = createAbortPromise(sh)
			if (abortPromise) {
				promises.push(abortPromise)
			}

			// For the first chunk, add a timeout to prevent indefinite hangs
			if (isFirstChunk) {
				const timeoutPromise = createFirstChunkTimeoutPromise(sh)
				promises.push(timeoutPromise)
			}

			return await Promise.race(promises)
		}

		// Read messages from MST store
		const messages = [...store.chat.tasks.get(ctx.taskId)!.notifications.items]

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
			lastApiReqIndex: 0,
			messages,
		}
		const chunkHandlers = createChunkHandlers(
			sh,
			chunkState,
			{
				say: (
					type: NotificationSay,
					text?: string,
					images?: string[],
					partial?: boolean,
					checkpoint?: CheckpointData,
					progressStatus?: ToolProgressStatus,
					options?: { isNonInteractive?: boolean },
					contextCondense?: ContextCondense,
					contextTruncation?: ContextTruncation,
				) =>
					systemBroadcast(
						task.taskId,
						type,
						text,
						images,
						partial,
						checkpoint,
						progressStatus,
						options ?? {},
						contextCondense,
						contextTruncation,
					),
				presentAssistantMessage: () => presentAssistantMessage(task),
			},
			store,
			rawChunkTracker,
		)

		let item = await nextChunkWithAbort(true)
		while (!item.done) {
			const chunk = item.value
			item = await nextChunkWithAbort(false)
			if (!chunk) {
				continue
			}

			const handler = chunkHandlers[chunk.type as keyof typeof chunkHandlers]
			if (handler) {
				await handler(chunk as { [key: string]: unknown } & ApiStreamChunk)
			}

			// Read back mutated state from the chunkState object
			const prevAssistantMessage = assistantMessage
			assistantMessage = chunkState.assistantMessage
			reasoningMessage = chunkState.reasoningMessage

			// 2-INTENT STREAMING: Accumulate text and send via direct postMessage exception
			if (chunk.type === "text") {
				const textChunk = chunk as { text?: string }
				if (textChunk.text) {
					accumulatedText += textChunk.text
					// Send accumulated text to frontend via streamingStore (non-MST)
					try {
						sendStreamChunk(provider, {
							taskId: ctx.taskId,
							text: accumulatedText,
						})
					} catch (postError) {
						// Non-critical: log but don't break streaming
						console.warn(`[handleStream] sendStreamChunk failed:`, postError)
					}
				}
			}

			if (task._state.abort) {
				console.log(`aborting stream, this.abandoned = ${String(task._state.abandoned)}`)
				if (!task._state.abandoned) {
					const updateFn = makeUpdateApiReqMsg()
					await abortStream(sh, "user_cancelled", undefined, updateFn, () => saveMessages(task.taskId))
				}
				break
			}

			if (task._state.didRejectTool) {
				assistantMessage += "\n[Response interrupted by user feedback]"
				break
			}

			if (task._state.didAlreadyUseTool) {
				assistantMessage +=
					"\n[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]"
				break
			}
		}

		diagnosticsManager.recordMetric("API Request (" + cachedModelId + ")", Date.now() - apiStartTime, "success")

		const currentTokens = {
			input: inputTokens,
			output: outputTokens,
			cacheWrite: cacheWriteTokens,
			cacheRead: cacheReadTokens,
			total: totalCost,
		}

		const assistantMsgContent = delegate.assistantMessageContent
		if (
			task._state.isWaitingForFirstChunk &&
			!assistantMessage &&
			!reasoningMessage &&
			!assistantMsgContent.length
		) {
			if (!task._state.abort) {
				throw new Error(t("common:errors.model_no_response"))
			}
		}

		// Start background usage collection
		const updateFn = makeUpdateApiReqMsg()
		drainStreamInBackground(sh, iterator, item, currentTokens, streamModelInfo, updateFn, () =>
			saveMessages(task.taskId),
		).catch((error: unknown) => {
			console.error("[Jabberwock] Background usage collection failed:", error)
		})

		// 2-INTENT STREAMING: Dispatch STREAMING_ENDED intent on success
		intentStore.createIntent({
			id: crypto.randomUUID(),
			type: IntentConstants.api.STREAMING_ENDED,
			payload: {
				taskId: ctx.taskId,
				assistantMessage,
				reasoningMessage,
				inputTokens,
				outputTokens,
				cacheWriteTokens,
				cacheReadTokens,
				totalCost,
				lastApiReqIndex: 0,
				assistantMsgContent,
				chunkState,
				messages,
			},
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})

		return {
			taskId: ctx.taskId,
			assistantMessage,
			reasoningMessage,
			pendingGroundingSources,
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
			totalCost,
			lastApiReqIndex: 0,
			messages,
			assistantMsgContent,
			chunkState,
			rawChunkTracker,
		}
	} catch (error: unknown) {
		// [TODO-LOG] Stream error
		const streamErrorMsg = `[TODO-LOG] [Task] Stream error (taskId: ${task.taskId}, error: ${error instanceof Error ? (error as Error).message : "unknown"}`
		console.log(streamErrorMsg)
		diagnosticsManager.log(streamErrorMsg, "error")

		if (!task._state.abandoned) {
			const cancelReason: CancelReason = task._state.abort ? "user_cancelled" : "streaming_failed"
			const rawErrorMessage =
				error instanceof Error
					? ((error as Error).message ?? JSON.stringify(serializeError(error), null, 2))
					: JSON.stringify(serializeError(error), null, 2)
			const streamingFailedMessage = task._state.abort
				? undefined
				: `${t("common:interruption.streamTerminatedByProvider", { rawErrorMessage })} ${rawErrorMessage}`

			const updateFn = makeUpdateApiReqMsg()
			await abortStream(sh, cancelReason, streamingFailedMessage, updateFn, () => saveMessages(task.taskId))

			if (task._state.abort) {
				task._state.setAbortReason(cancelReason)
				await delegate.abortTask()
			} else {
				console.error(
					`[Task#${task.taskId}.${task.instanceId}] Stream failed, will retry: ${streamingFailedMessage}`,
				)

				// Create a UserMessageReceived intent for retry instead of calling continuePipeline.
				// Pass the content blocks directly so the handler can re-process them.
				store.intentStore.createIntent({
					id: crypto.randomUUID(),
					type: IntentType.UserMessageReceived,
					payload: {
						taskId: ctx.taskId,
						content: ctx.userContent,
					},
					status: IntentStatus.Queued,
					createdAt: Date.now(),
				})
				return null
			}
		}
		return null
	} finally {
		task._state.setIsStreaming(false)
		task.currentRequestAbortController = undefined

		const streamStopMsg = `[TODO-LOG] [Task] Stream stop (taskId: ${task.taskId})`
		console.log(streamStopMsg)
		diagnosticsManager.log(streamStopMsg, "info")
	}
}
