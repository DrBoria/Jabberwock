import { Anthropic } from "@anthropic-ai/sdk"

import {
	type CancelReason,
	type ApiReqData,
	type Notification,
	type NotificationSay,
	type ModelInfo,
	type ToolName,
	getApiProtocol,
	getModelId,
	isRetiredProvider,
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
} from "../../../../api/transform/stream"
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../../../../shared/cost"
import { findLastIndex } from "../../../../shared/array"
import { t } from "../../../../i18n"
import type { AssistantMessageContent } from "../../../../features/chat/task/messages/actions"
import { RawChunkTracker } from "./rawChunkProcessor"
import { parseToolCall, parsePartialToolCall, parseFinalToolCall } from "../../../chat/tools/actions/tool-parser"
import type { ToolUse } from "../../../../shared/tools"
// ToolName imported from @jabberwock/types
import { diagnosticsManager } from "@jabberwock/devtool"
import type { IBackendRootStore } from "../../../store"

import type { StreamHandle } from "../../../chat/task/condense/actions/types"

/**
 * Callbacks injected by the caller to decouple stream chunk handling from Task.
 * The caller (e.g., mainLoop.ts) provides functions that bridge StreamHandle -> Task.
 */
export interface ChunkHandlerCallbacks {
	say: (type: NotificationSay, text?: string, images?: string[], partial?: boolean) => Promise<void>
	presentAssistantMessage: () => void
}

/**
 * Casts the MST streamingToolCallIndices to a plain Record for safe index access.
 * MST model types don't have index signatures, so we need this cast for
 * reads, writes, and deletes.
 */
function getStreamingToolCallIndices(task: StreamHandle): Record<string, number> {
	return task._state.streamingToolCallIndices
}

/**
 * Creates the chunk handler dispatch map for processing API stream chunks.
 * Each handler is a separate function that processes a specific chunk type.
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
			// Only apply formatting if the message contains sentence-ending punctuation followed by **
			let formattedReasoning = state.reasoningMessage
			if (state.reasoningMessage.includes("**")) {
				// Add line breaks before **Title** patterns that appear after sentence endings
				// This targets section headers like "...end of sentence.**Title Here**"
				// Handles periods, exclamation marks, and question marks
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
			// Handle grounding sources separately from regular content
			// to prevent state persistence issues - store them separately
			const groundingChunk = chunk as ApiStreamGroundingChunk
			const sources = groundingChunk.sources
			if (sources && sources.length > 0) {
				state.pendingGroundingSources.push(...sources)
			}
		},

		tool_call_partial: async (chunk) => {
			// Process raw tool call chunk through RawChunkTracker
			// which handles tracking, buffering, and emits events
			const partialChunk = chunk as ApiStreamToolCallPartialChunk
			const events = rawChunkTracker.processRawChunk({
				index: partialChunk.index,
				id: partialChunk.id ?? "",
				name: partialChunk.name ?? "",
				arguments: partialChunk.arguments ?? "",
			})

			for (const event of events) {
				if (event.type === "tool_call_start") {
					// Guard against duplicate tool_call_start events for the same tool ID.
					// This can occur due to stream retry, reconnection, or API quirks.
					// Without this check, duplicate tool_use blocks with the same ID would
					// be added to assistantMessageContent, causing API 400 errors:
					// "tool_use ids must be unique"
					const streamingToolCallIndices = task._state.streamingToolCallIndices
					if (event.id in streamingToolCallIndices) {
						console.warn(
							`[Task#${task.taskId}] Ignoring duplicate tool_call_start for ID: ${event.id} (tool: ${event.name})`,
						)
						continue
					}

					// Initialize streaming in MST store
					store.chat.startToolCall(event.id, event.name as ToolName)

					// Before adding a new tool, finalize any preceding text block
					// This prevents the text block from blocking tool presentation
					const assistantMsgContent = task.assistantMessageContent
					const lastBlock = assistantMsgContent[assistantMsgContent.length - 1]
					if (lastBlock?.type === "text" && lastBlock.partial) {
						lastBlock.partial = false
					}

					// Track the index where this tool will be stored
					const toolUseIndex = assistantMsgContent.length
					task._state.setStreamingToolCallIndex(event.id, toolUseIndex)

					// Create initial partial tool use
					const partialToolUse: ToolUse = {
						type: "tool_use",
						name: event.name as ToolName,
						params: {},
						partial: true,
						id: event.id,
					}

					// Add to content and present
					assistantMsgContent.push(partialToolUse)
					task._state.setUserMessageContentReady(true)
					callbacks.presentAssistantMessage()
				} else if (event.type === "tool_call_delta") {
					// Append delta to MST accumulator and parse partially
					store.chat.updateToolCallDelta(event.id, event.delta)
					const tc = store.chat.streamingToolCalls.get(event.id)
					const partialToolUse = tc ? parsePartialToolCall(event.id, tc.name, tc.argumentsAccumulator) : null

					if (partialToolUse) {
						// Get the index for this tool call
						const streamingToolCallIndices = getStreamingToolCallIndices(task)
						const toolUseIndex = streamingToolCallIndices[event.id]
						if (toolUseIndex !== undefined) {
							// Store the ID for native protocol
							;(partialToolUse as { id: string }).id = event.id

							// Update the existing tool use with new partial data
							const assistantMsgContent = task.assistantMessageContent
							assistantMsgContent[toolUseIndex] = partialToolUse

							// Present updated tool use
							callbacks.presentAssistantMessage()
						}
					}
				} else if (event.type === "tool_call_end") {
					// Finalize the streaming tool call
					const tc = store.chat.streamingToolCalls.get(event.id)
					const finalToolUse = tc ? parseFinalToolCall(event.id, tc.name, tc.argumentsAccumulator) : null
					if (tc) {
						store.chat.finalizeToolCall(event.id)
					}

					// Get the index for this tool call
					const streamingToolCallIndices = getStreamingToolCallIndices(task)
					const toolUseIndex = streamingToolCallIndices[event.id]

					if (finalToolUse) {
						// Store the tool call ID
						;(finalToolUse as { id: string }).id = event.id

						// Get the index and replace partial with final
						const assistantMsgContent = task.assistantMessageContent
						if (toolUseIndex !== undefined) {
							assistantMsgContent[toolUseIndex] = finalToolUse
						}

						// Clean up tracking
						task._state.deleteStreamingToolCallIndex(event.id)

						// Mark that we have new content to process
						task._state.setUserMessageContentReady(true)

						// Present the finalized tool call
						callbacks.presentAssistantMessage()
					} else if (toolUseIndex !== undefined) {
						// finalizeStreamingToolCall returned null (malformed JSON or missing args)
						// Mark the tool as non-partial so it's presented as complete, but execution
						// will be short-circuited in presentAssistantMessage with a structured tool_result.
						const assistantMsgContent = task.assistantMessageContent
						const existingToolUse = assistantMsgContent[toolUseIndex]
						if (existingToolUse && existingToolUse.type === "tool_use") {
							existingToolUse.partial = false
							// Ensure it has the ID for native protocol
							;(existingToolUse as { id: string }).id = event.id
						}

						// Clean up tracking
						task._state.deleteStreamingToolCallIndex(event.id)

						// Mark that we have new content to process
						task._state.setUserMessageContentReady(true)

						// Present the tool call - validation will handle missing params
						callbacks.presentAssistantMessage()
					}
				}
			}
		},

		tool_call: (chunk) => {
			// Legacy: Handle complete tool calls (for backward compatibility)
			// Convert native tool call to ToolUse format
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

			// Store the tool call ID on the ToolUse object for later reference
			// This is needed to create tool_result blocks that reference the correct tool_use_id
			toolUse.id = toolCallChunk.id

			// Add the tool use to assistant message content
			const assistantMsgContent = task.assistantMessageContent
			assistantMsgContent.push(toolUse)

			// Mark that we have new content to process
			task._state.setUserMessageContentReady(true)

			// Present the tool call to user - presentAssistantMessage will execute
			// tools sequentially and accumulate all results in userMessageContent
			callbacks.presentAssistantMessage()
		},

		text: async (chunk) => {
			const textChunk = chunk as ApiStreamTextChunk
			state.assistantMessage += textChunk.text

			// Native tool calling: text chunks are plain text.
			// Create or update a text content block directly
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

	// Calculate total tokens and cost using provider-aware function
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
