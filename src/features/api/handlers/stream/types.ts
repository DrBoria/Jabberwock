import type { StreamHandle } from "@features/chat/task/condense/actions/types"
import type { ITaskModel } from "@features/chat/task/store"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions/types"
import type { Notification } from "@jabberwock/types"
import { GroundingSource } from "@api/transform/stream"
import { RawChunkTracker } from "@features/api/handlers/helpers/process/rawChunkProcessor"

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
	rawChunkTracker: RawChunkTracker
}

export type TokenState = {
	inputTokens: number
	outputTokens: number
	cacheWriteTokens: number
	cacheReadTokens: number
	totalCost: number | undefined
}

export function toStreamHandle(task: ITaskModel): StreamHandle {
	return task as ITaskModel & StreamHandle
}
