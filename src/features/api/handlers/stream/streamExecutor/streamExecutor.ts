import { type ModelInfo } from "@jabberwock/types"
import { t } from "@i18n"
import { getDiffViewProvider } from "@features/foundation/time-machine/actions/getTimeMachine"
import { diagnosticsManager } from "@jabberwock/devtool"
import { RawChunkTracker } from "@features/api/handlers/helpers/process/rawChunkProcessor"
import {
	resetStreamingState,
	drainStreamInBackground,
} from "@features/api/handlers/helpers/recover/requestAbortManager"
import { saveMessages } from "@features/chat/task/messages/actions/saveMessages"
import type { ApiRequestContext } from "@features/api/handlers/helpers/prepare/prepareApiRequest"
import { sendStateWithoutTaskHistory } from "@features/chat/task/messages/events/actions/sendMessageEvent"
import { handleStreamError } from "@features/api/handlers/stream/streamErrorHandler"
import { type StreamResult, type TokenState, toStreamHandle } from "@features/api/handlers/stream/types"
import { createUpdateApiReqMsg, processApiResponse } from "./stream-executor-utils"
import { dispatchStreamingStarted, dispatchStreamingEnded } from "./stream-executor-events"
import { sendStreamChunk } from "@features/api/events/actions"
export async function executeApiStream(
	ctx: ApiRequestContext,
	rawChunkTracker: RawChunkTracker,
): Promise<StreamResult | null> {
	const { task, delegate, store } = ctx
	const sh = toStreamHandle(task)

	const tokenState: TokenState = {
		inputTokens: 0,
		outputTokens: 0,
		cacheWriteTokens: 0,
		cacheReadTokens: 0,
		totalCost: undefined,
	}

	const accumulatedText: { value: string } = { value: "" }
	const makeUpdateFn = createUpdateApiReqMsg(sh, tokenState, store, ctx.taskId, delegate)

	resetStreamingState(sh, store, rawChunkTracker)
	// Reset streaming store in webview before starting a new stream attempt
	// (e.g. on retry). Without this, new chunks append to the previous failed
	// attempt's text, causing visible stuttering/duplication.
	sendStreamChunk({ taskId: ctx.taskId, text: "", reset: true })
	await getDiffViewProvider().reset()

	if (!delegate.api) {
		console.error(`[handleStream] delegate.api not set for task ${ctx.taskId}`)
		return null
	}

	const cachedStreamingModel = delegate.api.getModel() as { id: string; info: ModelInfo }
	task.setCachedStreamingModel(cachedStreamingModel)
	const streamModelInfo = cachedStreamingModel.info
	const cachedModelId = cachedStreamingModel.id

	diagnosticsManager.setCurrentAction(t("diagnostics:actions.apiRequest", { model: cachedModelId }))
	diagnosticsManager.log(`[API] Starting request to ${cachedModelId}`)

	dispatchStreamingStarted(store, ctx.taskId, cachedModelId)

	const apiStartTime = Date.now()
	console.log(`[DEBUG: TaskLoop#${task.taskId}] Phase: API Request Start (Model: ${cachedModelId})`)

	const attemptApiRequest = delegate.attemptApiRequest
	if (typeof attemptApiRequest !== "function") {
		console.error(`[handleStream] FATAL: attemptApiRequest is ${typeof attemptApiRequest} on task ${ctx.taskId}`)
		console.error(`[handleStream] delegate constructor: ${delegate.constructor?.name}`)
		console.error(`[handleStream] delegate prototype: ${Object.getPrototypeOf(delegate)?.constructor?.name}`)
		throw new Error(`attemptApiRequest is not a function (type: ${typeof attemptApiRequest})`)
	}

	const stream = attemptApiRequest(ctx.retryAttempt, { skipProviderRateLimit: true })

	task._state.setIsStreaming(true)

	sendStateWithoutTaskHistory()

	try {
		const iterator = (stream as AsyncIterable<{ [key: string]: unknown }>)[Symbol.asyncIterator]()

		const result = await processApiResponse(
			ctx,
			sh,
			iterator,
			rawChunkTracker,
			tokenState,
			accumulatedText,
			makeUpdateFn,
		)

		diagnosticsManager.recordMetric("API Request (" + cachedModelId + ")", Date.now() - apiStartTime, "success")

		const currentTokens = {
			input: tokenState.inputTokens,
			output: tokenState.outputTokens,
			cacheWrite: tokenState.cacheWriteTokens,
			cacheRead: tokenState.cacheReadTokens,
			total: tokenState.totalCost,
		}

		void drainStreamInBackground(
			sh,
			iterator,
			await iterator.next(),
			currentTokens,
			streamModelInfo,
			makeUpdateFn,
			() => saveMessages(task.taskId),
		).catch((error: unknown) => {
			console.error("[Jabberwock] Background usage collection failed:", error)
		})

		dispatchStreamingEnded(store, ctx.taskId, {
			assistantMessage: result.assistantMessage,
			reasoningMessage: result.reasoningMessage,
			inputTokens: tokenState.inputTokens,
			outputTokens: tokenState.outputTokens,
			cacheWriteTokens: tokenState.cacheWriteTokens,
			cacheReadTokens: tokenState.cacheReadTokens,
			totalCost: tokenState.totalCost,
			assistantMsgContent: result.assistantMsgContent,
			chunkState: result.chunkState,
			messages: [...store.chat.tasks.get(ctx.taskId)!.notifications.items],
		})

		return result
	} catch (error: unknown) {
		return await handleStreamError(ctx, sh, error, makeUpdateFn)
	} finally {
		task._state.setIsStreaming(false)
		task.setCurrentRequestAbortController(undefined)

		const streamStopMsg = `[TODO-LOG] [Task] Stream stop (taskId: ${ctx.task.taskId})`
		console.log(streamStopMsg)
		diagnosticsManager.log(streamStopMsg, "info")
	}
}
