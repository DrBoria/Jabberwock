import type { StreamHandle } from "@features/chat/task/condense/actions/types"
import type { ChunkHandlerCallbacks } from "@features/api/handlers/stream/on-stream-chunk-received"
import { parsePartialToolCall, parseFinalToolCall } from "@features/chat/tools/actions/parse-tool-call"
import type { ToolUse } from "@shared/tools"
import type { ToolName } from "@jabberwock/types"
import type { IBackendRootStore } from "@features/store"

function getStreamingToolCallIndices(task: StreamHandle): Record<string, number> {
	return task._state.streamingToolCallIndices
}

export async function handleToolCallStartEvent(
	task: StreamHandle,
	store: IBackendRootStore,
	callbacks: ChunkHandlerCallbacks,
	event: { id: string; name: string },
): Promise<void> {
	const streamingToolCallIndices = task._state.streamingToolCallIndices
	if (event.id in streamingToolCallIndices) {
		console.warn(
			`[Task#${task.taskId}] Ignoring duplicate tool_call_start for ID: ${event.id} (tool: ${event.name})`,
		)
		return
	}

	store.chat.startToolCall(event.id, event.name as ToolName)

	const assistantMsgContent = task.assistantMessageContent
	const lastBlock = assistantMsgContent[assistantMsgContent.length - 1]
	if (lastBlock?.type === "text" && lastBlock.partial) {
		lastBlock.partial = false
	}

	const toolUseIndex = assistantMsgContent.length
	task._state.setStreamingToolCallIndex(event.id, toolUseIndex)

	const partialToolUse: ToolUse = {
		type: "tool_use",
		name: event.name as ToolName,
		params: {},
		partial: true,
		id: event.id,
	}

	assistantMsgContent.push(partialToolUse)
	task._state.setUserMessageContentReady(true)
	callbacks.presentAssistantMessage()
}

export async function handleToolCallDeltaEvent(
	task: StreamHandle,
	store: IBackendRootStore,
	callbacks: ChunkHandlerCallbacks,
	event: { id: string; delta: string },
): Promise<void> {
	store.chat.updateToolCallDelta(event.id, event.delta)
	const tc = store.chat.streamingToolCalls.get(event.id)
	const partialToolUse = tc ? parsePartialToolCall(event.id, tc.name, tc.argumentsAccumulator) : null

	if (!partialToolUse) {
		return
	}

	const streamingToolCallIndices = getStreamingToolCallIndices(task)
	const toolUseIndex = streamingToolCallIndices[event.id]
	if (toolUseIndex === undefined) {
		return
	}

	;(partialToolUse as { id: string }).id = event.id

	const assistantMsgContent = task.assistantMessageContent
	assistantMsgContent[toolUseIndex] = partialToolUse

	callbacks.presentAssistantMessage()
}

export async function handleToolCallEndEvent(
	task: StreamHandle,
	store: IBackendRootStore,
	callbacks: ChunkHandlerCallbacks,
	event: { id: string },
): Promise<void> {
	const tc = store.chat.streamingToolCalls.get(event.id)
	const finalToolUse = tc ? parseFinalToolCall(event.id, tc.name, tc.argumentsAccumulator) : null
	if (tc) {
		store.chat.finalizeToolCall(event.id)
	}

	const streamingToolCallIndices = getStreamingToolCallIndices(task)
	const toolUseIndex = streamingToolCallIndices[event.id]

	if (finalToolUse) {
		;(finalToolUse as { id: string }).id = event.id

		const assistantMsgContent = task.assistantMessageContent
		if (toolUseIndex !== undefined) {
			assistantMsgContent[toolUseIndex] = finalToolUse
		}

		task._state.deleteStreamingToolCallIndex(event.id)
		task._state.setUserMessageContentReady(true)
		callbacks.presentAssistantMessage()
	} else if (toolUseIndex !== undefined) {
		const assistantMsgContent = task.assistantMessageContent
		const existingToolUse = assistantMsgContent[toolUseIndex]
		if (existingToolUse && existingToolUse.type === "tool_use") {
			existingToolUse.partial = false
			;(existingToolUse as { id: string }).id = event.id
		}

		task._state.deleteStreamingToolCallIndex(event.id)
		task._state.setUserMessageContentReady(true)
		callbacks.presentAssistantMessage()
	}
}
