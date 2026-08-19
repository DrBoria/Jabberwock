import { IntentStatus } from "@jabberwock/types"
import { IntentConstants } from "@intentConstants"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions/types"
import type { Notification } from "@jabberwock/types"

export function dispatchStreamingStarted(
	store: import("@features/store").IBackendRootStore,
	taskId: string,
	modelId: string,
): void {
	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentConstants.api.STREAMING_STARTED,
		payload: { taskId, modelId },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

export function dispatchStreamingEnded(
	store: import("@features/store").IBackendRootStore,
	taskId: string,
	result: {
		assistantMessage: string
		reasoningMessage: string
		inputTokens: number
		outputTokens: number
		cacheWriteTokens: number
		cacheReadTokens: number
		totalCost: number | undefined
		assistantMsgContent: AssistantMessageContent[]
		chunkState: { [key: string]: unknown }
		messages: Notification[]
	},
): void {
	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentConstants.api.STREAMING_ENDED,
		payload: {
			taskId,
			assistantMessage: result.assistantMessage,
			reasoningMessage: result.reasoningMessage,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
			cacheWriteTokens: result.cacheWriteTokens,
			cacheReadTokens: result.cacheReadTokens,
			totalCost: result.totalCost,
			lastApiReqIndex: 0,
			assistantMsgContent: [...result.assistantMsgContent],
			chunkState: { ...result.chunkState },
			messages: result.messages ? [...result.messages] : undefined,
		},
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}
