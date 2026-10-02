import { type ApiStreamChunk } from "@api/transform/stream"
import type { ITaskModel } from "@features/chat/task"
import type { StreamHandle } from "@features/chat/task/condense"
import { RawChunkTracker } from "@features/api/handlers/request/index"
import { createChunkHandlers } from "./on-stream-chunk-received"
import { createAbortPromise, createFirstChunkTimeoutPromise } from "@features/api"
import { emitBroadcast } from "@features/chat/task/messages"
import type { AssistantMessageContent } from "@features/chat/task/messages"
import { presentAssistantMessage } from "@features/chat/task/messages"
import { sendStreamChunk } from "@features/api/events/actions"
import { GroundingSource } from "@api/transform/stream"

async function buildNextChunkWithAbort(
	iterator: AsyncIterator<{ [key: string]: unknown }>,
	sh: StreamHandle,
	isFirstChunk: boolean,
): Promise<IteratorResult<{ [key: string]: unknown }>> {
	const nextPromise: Promise<IteratorResult<{ [key: string]: unknown }>> = iterator.next()
	const promises: Promise<IteratorResult<{ [key: string]: unknown }>>[] = [nextPromise]

	const abortPromise = createAbortPromise(sh)
	if (abortPromise) {
		promises.push(abortPromise)
	}

	if (isFirstChunk) {
		const timeoutPromise = createFirstChunkTimeoutPromise(sh)
		promises.push(timeoutPromise)
	}

	return await Promise.race(promises)
}

function checkBreakConditions(task: ITaskModel, chunkState: { assistantMessage: string }): "continue" | "break" {
	if (task._state.abort) {
		return "break"
	}
	if (task._state.didRejectTool) {
		chunkState.assistantMessage += "\n[Response interrupted by user feedback]"
		return "break"
	}
	if (task._state.didAlreadyUseTool) {
		chunkState.assistantMessage +=
			"\n[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]"
		return "break"
	}
	return "continue"
}

async function processChunkInLoop(
	chunkResult: IteratorResult<{ [key: string]: unknown }>,
	chunkHandlers: Partial<Record<ApiStreamChunk["type"], (chunk: ApiStreamChunk) => Promise<void> | void>>,
	task: ITaskModel,
	chunkState: {
		assistantMessage: string
		reasoningMessage: string
		pendingGroundingSources: GroundingSource[]
		[key: string]: unknown
	},
	accumulatedText: { value: string },
	taskId: string,
	onFirstContent?: () => void,
): Promise<"continue" | "break"> {
	const chunk = chunkResult.value
	if (!chunk) {
		return "continue"
	}

	const handler = chunkHandlers[chunk.type as keyof typeof chunkHandlers]
	if (handler) {
		await handler(chunk as { [key: string]: unknown } & ApiStreamChunk)
	}

	if ((chunk.type === "text" || chunk.type === "reasoning") && onFirstContent) {
		onFirstContent()
		onFirstContent = undefined
	}

	if (chunk.type === "text") {
		const textChunk = chunk as { text?: string }
		if (textChunk.text) {
			accumulatedText.value += textChunk.text
			try {
				sendStreamChunk({ taskId, text: textChunk.text })
			} catch (postError) {
				console.warn(`[handleStream] sendStreamChunk failed:`, postError)
			}
		}
	}

	return checkBreakConditions(task, chunkState)
}

export async function runStreamLoop(
	sh: StreamHandle,
	store: import("@features/store").IBackendRootStore,
	taskId: string,
	delegate: import("@features/chat/task/condense/types").TaskDelegate,
	rawChunkTracker: RawChunkTracker,
	tokenState: {
		inputTokens: number
		outputTokens: number
		cacheWriteTokens: number
		cacheReadTokens: number
		totalCost: number | undefined
	},
	accumulatedText: { value: string },
	iterator: AsyncIterator<{ [key: string]: unknown }>,
	onFirstContent?: () => void,
): Promise<{
	assistantMessage: string
	reasoningMessage: string
	pendingGroundingSources: GroundingSource[]
	assistantMsgContent: AssistantMessageContent[]
	task: import("@features/chat/task").ITaskModel
	chunkState: { [key: string]: unknown }
}> {
	const assistantMsgContent = delegate.assistantMessageContent
	const task = store.chat.tasks.get(taskId)!
	const messages = [...task.notifications.items]

	const chunkState = {
		assistantMessage: "",
		reasoningMessage: "",
		pendingGroundingSources: [] as GroundingSource[],
		inputTokens: tokenState.inputTokens,
		outputTokens: tokenState.outputTokens,
		cacheWriteTokens: tokenState.cacheWriteTokens,
		cacheReadTokens: tokenState.cacheReadTokens,
		totalCost: tokenState.totalCost,
		streamModelInfo: delegate.cachedStreamingModel?.info as { [key: string]: unknown },
		lastApiReqIndex: 0,
		messages,
	}

	const chunkHandlers = createChunkHandlers(
		sh,
		chunkState,
		{
			say: (
				type: import("@jabberwock/types").NotificationSay,
				text?: string,
				images?: string[],
				partial?: boolean,
			) => emitBroadcast("system", taskId, type, text, images, partial),
			presentAssistantMessage: () => presentAssistantMessage(task),
		},
		store,
		rawChunkTracker,
	)

	let item = await buildNextChunkWithAbort(iterator, sh, true)

	let firstContent = onFirstContent
	while (!item.done) {
		const action = await processChunkInLoop(
			item,
			chunkHandlers,
			task,
			chunkState,
			accumulatedText,
			taskId,
			firstContent,
		)
		if (action === "break") {
			break
		}
		firstContent = undefined
		item = await buildNextChunkWithAbort(iterator, sh, false)
	}

	return {
		assistantMessage: chunkState.assistantMessage,
		reasoningMessage: chunkState.reasoningMessage,
		pendingGroundingSources: chunkState.pendingGroundingSources,
		assistantMsgContent,
		task,
		chunkState,
	}
}
