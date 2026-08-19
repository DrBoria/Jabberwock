import { type CancelReason } from "@jabberwock/types"
import { t } from "@i18n"
import { RawChunkTracker } from "@features/api/handlers/helpers/process/rawChunkProcessor"
import type { ApiRequestContext } from "@features/api/handlers/helpers/prepare/prepareApiRequest"
import { runStreamLoop } from "@features/api/handlers/stream/streamRunner"
import type { StreamHandle } from "@features/chat/task/condense/actions/types"
import { updateApiReqMsg } from "@features/api/handlers/stream/on-stream-chunk-received"
import { type StreamResult, type TokenState } from "@features/api/handlers/stream/types"

export function createUpdateApiReqMsg(
	sh: StreamHandle,
	tokenState: TokenState,
	store: import("@features/store").IBackendRootStore,
	taskId: string,
	delegate: import("@features/chat/task/condense/actions/types").TaskDelegate,
): (cancelReason?: CancelReason, streamingFailedMessage?: string) => void {
	return (cancelReason?, streamingFailedMessage?) => {
		updateApiReqMsg(
			sh,
			{
				inputTokens: tokenState.inputTokens,
				outputTokens: tokenState.outputTokens,
				cacheWriteTokens: tokenState.cacheWriteTokens,
				cacheReadTokens: tokenState.cacheReadTokens,
				totalCost: tokenState.totalCost,
				streamModelInfo: delegate.cachedStreamingModel?.info as { [key: string]: unknown },
				lastApiReqIndex: 0,
				messages: [...store.chat.tasks.get(taskId)!.notifications.items],
			},
			cancelReason,
			streamingFailedMessage,
		)
	}
}

export async function processApiResponse(
	ctx: ApiRequestContext,
	sh: StreamHandle,
	iterator: AsyncIterator<{ [key: string]: unknown }>,
	rawChunkTracker: RawChunkTracker,
	tokenState: TokenState,
	accumulatedText: { value: string },
	_makeUpdateFn: () => void,
): Promise<StreamResult> {
	const { task, delegate, store } = ctx

	const loopResult = await runStreamLoop(
		sh,
		store,
		ctx.taskId,
		delegate,
		rawChunkTracker,
		tokenState,
		accumulatedText,
		iterator,
	)

	if (
		task._state.isWaitingForFirstChunk &&
		!loopResult.assistantMessage &&
		!loopResult.reasoningMessage &&
		!loopResult.assistantMsgContent.length
	) {
		if (!task._state.abort) {
			throw new Error(t("common:errors.model_no_response"))
		}
	}

	return {
		taskId: ctx.taskId,
		assistantMessage: loopResult.assistantMessage,
		reasoningMessage: loopResult.reasoningMessage,
		pendingGroundingSources: loopResult.pendingGroundingSources,
		inputTokens: loopResult.chunkState.inputTokens as number,
		outputTokens: loopResult.chunkState.outputTokens as number,
		cacheWriteTokens: loopResult.chunkState.cacheWriteTokens as number,
		cacheReadTokens: loopResult.chunkState.cacheReadTokens as number,
		totalCost: loopResult.chunkState.totalCost as number | undefined,
		lastApiReqIndex: 0,
		messages: [...store.chat.tasks.get(ctx.taskId)!.notifications.items],
		assistantMsgContent: loopResult.assistantMsgContent,
		chunkState: loopResult.chunkState,
		rawChunkTracker,
	}
}
