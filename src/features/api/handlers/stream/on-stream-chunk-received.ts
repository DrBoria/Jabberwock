import { Anthropic } from "@anthropic-ai/sdk"

import {
	type CancelReason,
	type ApiReqData,
	type Notification,
	type NotificationSay,
	type ModelInfo,
	getApiProtocol,
	getModelId,
	isRetiredProvider,
	type ToolName,
} from "@jabberwock/types"

import {
	ApiStreamChunk,
	ApiStreamGroundingChunk,
	ApiStreamReasoningChunk,
	ApiStreamTextChunk,
	ApiStreamToolCallChunk,
	ApiStreamToolCallPartialChunk,
	ApiStreamUsageChunk,
	GroundingSource,
} from "@api/transform/stream"
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "@shared/api/cost"
import { findLastIndex } from "@shared/array"
import { t } from "@i18n"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions"
import { RawChunkTracker } from "@features/api/handlers/helpers/process/rawChunkProcessor"
import { parseToolCall } from "@features/chat/tools/actions/parse-tool-call"
import { diagnosticsManager } from "@jabberwock/devtool"
import type { IBackendRootStore } from "@features/store"

import type { StreamHandle } from "@features/chat/task/condense/actions/types"
import {
	handleToolCallStartEvent,
	handleToolCallDeltaEvent,
	handleToolCallEndEvent,
} from "@features/api/handlers/helpers/process/toolCallHandlers"

/**
 * Callbacks injected by the caller to decouple stream chunk handling from Task.
 */
export interface ChunkHandlerCallbacks {
	say: (type: NotificationSay, text?: string, images?: string[], partial?: boolean) => Promise<void>
	presentAssistantMessage: () => void
}

/**
 * Creates the chunk handler dispatch map for processing API stream chunks.
 */
export function createChunkHandlers(
	task: StreamHandle,
	state: {
		assistantMessage: string
		reasoningMessage: string
		pendingGroundingSources: GroundingSource[]
		inputTokens: number
		outputTokens: number
		cacheWriteTokens: number
		cacheReadTokens: number
		totalCost: number | undefined
		streamModelInfo: { [key: string]: unknown }
		lastApiReqIndex: number
		messages: Notification[]
	},
	callbacks: ChunkHandlerCallbacks,
	store: IBackendRootStore,
	rawChunkTracker: RawChunkTracker,
): Partial<Record<ApiStreamChunk["type"], (chunk: ApiStreamChunk) => Promise<void> | void>> {
	return {
		reasoning: async (chunk) => {
			state.reasoningMessage += (chunk as ApiStreamReasoningChunk).text
			let formattedReasoning = state.reasoningMessage
			if (state.reasoningMessage.includes("**")) {
				formattedReasoning = state.reasoningMessage.replace(/([.!?])\*\*([^*\n]+)\*\*/g, "$1\n\n**$2**")
			}
			await callbacks.say("reasoning", formattedReasoning, undefined, true)
		},
		usage: (chunk) => {
			const usageChunk = chunk as ApiStreamUsageChunk
			state.inputTokens += usageChunk.inputTokens
			state.outputTokens += usageChunk.outputTokens
			state.cacheWriteTokens += usageChunk.cacheWriteTokens ?? 0
			state.cacheReadTokens += usageChunk.cacheReadTokens ?? 0
			state.totalCost = usageChunk.totalCost
		},

		grounding: (chunk) => {
			const groundingChunk = chunk as ApiStreamGroundingChunk
			const sources = groundingChunk.sources
			if (sources && sources.length > 0) {
				state.pendingGroundingSources.push(...sources)
			}
		},

		tool_call_partial: async (chunk) => {
			const partialChunk = chunk as ApiStreamToolCallPartialChunk
			const events = rawChunkTracker.processRawChunk({
				index: partialChunk.index,
				id: partialChunk.id ?? "",
				name: partialChunk.name ?? "",
				arguments: partialChunk.arguments ?? "",
			})

			for (const event of events) {
				if (event.type === "tool_call_start") {
					await handleToolCallStartEvent(task, store, callbacks, event)
				} else if (event.type === "tool_call_delta") {
					await handleToolCallDeltaEvent(task, store, callbacks, event)
				} else if (event.type === "tool_call_end") {
					await handleToolCallEndEvent(task, store, callbacks, event)
				}
			}
		},

		tool_call: (chunk) => {
			const toolCallChunk = chunk as ApiStreamToolCallChunk
			const toolUse = parseToolCall({
				id: toolCallChunk.id,
				name: toolCallChunk.name as ToolName,
				arguments: toolCallChunk.arguments,
			})

			if (!toolUse) {
				console.error(`[jabberwock] Failed to parse tool call for task ${task.taskId}:`, chunk)
				return
			}

			toolUse.id = toolCallChunk.id

			const assistantMsgContent = task.assistantMessageContent
			assistantMsgContent.push(toolUse)
			task._state.setUserMessageContentReady(true)
			callbacks.presentAssistantMessage()
		},

		text: async (chunk) => {
			const textChunk = chunk as ApiStreamTextChunk
			state.assistantMessage += textChunk.text

			const assistantMsgContent = task.assistantMessageContent
			const lastBlock = assistantMsgContent[assistantMsgContent.length - 1]
			if (lastBlock?.type === "text" && lastBlock.partial) {
				lastBlock.text = state.assistantMessage
			} else {
				assistantMsgContent.push({
					type: "text",
					text: state.assistantMessage,
					partial: true,
				})
				task._state.setUserMessageContentReady(true)
			}
			callbacks.presentAssistantMessage()
		},
	}
}

/**
 * Updates the API request message with token usage and cost data.
 */
export function updateApiReqMsg(
	task: StreamHandle,
	state: {
		inputTokens: number
		outputTokens: number
		cacheWriteTokens: number
		cacheReadTokens: number
		totalCost: number | undefined
		streamModelInfo: { [key: string]: unknown }
		lastApiReqIndex: number
		messages: Notification[]
	},
	cancelReason?: CancelReason,
	streamingFailedMessage?: string,
): void {
	if (state.lastApiReqIndex < 0 || !state.messages[state.lastApiReqIndex]) {
		return
	}

	const existingData = JSON.parse(state.messages[state.lastApiReqIndex].text || "{}")

	const modelId = getModelId(task.apiConfiguration)
	const apiProvider = task.apiConfiguration.apiProvider
	const apiProtocol = getApiProtocol(
		apiProvider && !isRetiredProvider(apiProvider) ? apiProvider : undefined,
		modelId,
	)

	const costResult =
		apiProtocol === "anthropic"
			? calculateApiCostAnthropic(
					state.streamModelInfo as ModelInfo,
					state.inputTokens,
					state.outputTokens,
					state.cacheWriteTokens,
					state.cacheReadTokens,
				)
			: calculateApiCostOpenAI(
					state.streamModelInfo as ModelInfo,
					state.inputTokens,
					state.outputTokens,
					state.cacheWriteTokens,
					state.cacheReadTokens,
				)

	task.messages[state.lastApiReqIndex].text = JSON.stringify({
		...existingData,
		tokensIn: costResult.totalInputTokens,
		tokensOut: costResult.totalOutputTokens,
		cacheWrites: state.cacheWriteTokens,
		cacheReads: state.cacheReadTokens,
		cost: state.totalCost ?? costResult.totalCost,
		cancelReason,
		streamingFailedMessage,
	} satisfies ApiReqData)
}
