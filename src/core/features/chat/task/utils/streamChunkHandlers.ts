import { Anthropic } from "@anthropic-ai/sdk"

import {
	type ClineApiReqCancelReason,
	type ClineApiReqInfo,
	type ClineMessage,
	type ToolName,
	getApiProtocol,
	getModelId,
	isRetiredProvider,
} from "@jabberwock/types"

import { ApiStreamChunk, GroundingSource } from "../../../../../api/transform/stream"
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../../../../../shared/cost"
import { findLastIndex } from "../../../../../shared/array"
import { t } from "../../../../../i18n"
import { type AssistantMessageContent, presentAssistantMessage } from "../../../../assistant-message"
import { NativeToolCallParser } from "../../../../assistant-message/NativeToolCallParser"
// ToolName imported from @jabberwock/types
import { diagnosticsManager } from "@jabberwock/devtool"
import { Task } from "../../../../task/Task"

/**
 * Creates the chunk handler dispatch map for processing API stream chunks.
 * Each handler is a separate function that processes a specific chunk type.
 */
export function createChunkHandlers(
	task: Task,
	state: {
		assistantMessage: string
		reasoningMessage: string
		pendingGroundingSources: GroundingSource[]
		inputTokens: number
		outputTokens: number
		cacheWriteTokens: number
		cacheReadTokens: number
		totalCost: number | undefined
		streamModelInfo: any
		lastApiReqIndex: number
		clineMessages: ClineMessage[]
	},
): Partial<Record<ApiStreamChunk["type"], (chunk: any) => Promise<void> | void>> {
	const tsk = task as any

	return {
		reasoning: async (chunk) => {
			state.reasoningMessage += chunk.text
			// Only apply formatting if the message contains sentence-ending punctuation followed by **
			let formattedReasoning = state.reasoningMessage
			if (state.reasoningMessage.includes("**")) {
				// Add line breaks before **Title** patterns that appear after sentence endings
				// This targets section headers like "...end of sentence.**Title Here**"
				// Handles periods, exclamation marks, and question marks
				formattedReasoning = state.reasoningMessage.replace(/([.!?])\*\*([^*\n]+)\*\*/g, "$1\n\n**$2**")
			}
			await task.say("reasoning", formattedReasoning, undefined, true)

			// Phase 1: Sync reasoning to MST real-time
			const provider = task.providerRef.deref()
			if (provider && provider.chatStore) {
				const node = provider.chatStore.nodes.get(task.taskId)
				if (node) {
					node.updateApiMessage(task.instanceId + "_assistant", {
						role: "assistant",
						content: [{ type: "reasoning", text: state.reasoningMessage }, ...tsk.assistantMessageContent],
					})
				}
			}
		},

		usage: (chunk) => {
			state.inputTokens += chunk.inputTokens
			state.outputTokens += chunk.outputTokens
			state.cacheWriteTokens += chunk.cacheWriteTokens ?? 0
			state.cacheReadTokens += chunk.cacheReadTokens ?? 0
			state.totalCost = chunk.totalCost
		},

		grounding: (chunk) => {
			// Handle grounding sources separately from regular content
			// to prevent state persistence issues - store them separately
			if (chunk.sources && chunk.sources.length > 0) {
				state.pendingGroundingSources.push(...chunk.sources)
			}
		},

		tool_call_partial: async (chunk) => {
			// Process raw tool call chunk through NativeToolCallParser
			// which handles tracking, buffering, and emits events
			const events = NativeToolCallParser.processRawChunk({
				index: chunk.index,
				id: chunk.id,
				name: chunk.name,
				arguments: chunk.arguments,
			})

			for (const event of events) {
				if (event.type === "tool_call_start") {
					// Guard against duplicate tool_call_start events for the same tool ID.
					// This can occur due to stream retry, reconnection, or API quirks.
					// Without this check, duplicate tool_use blocks with the same ID would
					// be added to assistantMessageContent, causing API 400 errors:
					// "tool_use ids must be unique"
					if (tsk.streamingToolCallIndices.has(event.id)) {
						console.warn(
							`[Task#${task.taskId}] Ignoring duplicate tool_call_start for ID: ${event.id} (tool: ${event.name})`,
						)
						continue
					}

					// Initialize streaming in NativeToolCallParser
					NativeToolCallParser.startStreamingToolCall(event.id, event.name as ToolName)

					// Before adding a new tool, finalize any preceding text block
					// This prevents the text block from blocking tool presentation
					const lastBlock = tsk.assistantMessageContent[tsk.assistantMessageContent.length - 1]
					if (lastBlock?.type === "text" && lastBlock.partial) {
						lastBlock.partial = false
					}

					// Track the index where this tool will be stored
					const toolUseIndex = tsk.assistantMessageContent.length
					tsk.streamingToolCallIndices.set(event.id, toolUseIndex)

					// Create initial partial tool use
					const partialToolUse: any = {
						type: "tool_use",
						name: event.name as ToolName,
						params: {},
						partial: true,
					}

					// Store the ID for native protocol
					;(partialToolUse as { id: string }).id = event.id

					// Add to content and present
					tsk.assistantMessageContent.push(partialToolUse)
					tsk.userMessageContentReady = false
					presentAssistantMessage(task)
				} else if (event.type === "tool_call_delta") {
					// Process chunk using streaming JSON parser
					const partialToolUse = NativeToolCallParser.processStreamingChunk(event.id, event.delta)

					if (partialToolUse) {
						// Get the index for this tool call
						const toolUseIndex = tsk.streamingToolCallIndices.get(event.id)
						if (toolUseIndex !== undefined) {
							// Store the ID for native protocol
							;(partialToolUse as { id: string }).id = event.id

							// Update the existing tool use with new partial data
							tsk.assistantMessageContent[toolUseIndex] = partialToolUse

							// Present updated tool use
							presentAssistantMessage(task)
						}
					}
				} else if (event.type === "tool_call_end") {
					// Finalize the streaming tool call
					const finalToolUse = NativeToolCallParser.finalizeStreamingToolCall(event.id)

					// Get the index for this tool call
					const toolUseIndex = tsk.streamingToolCallIndices.get(event.id)

					if (finalToolUse) {
						// Store the tool call ID
						;(finalToolUse as { id: string }).id = event.id

						// Get the index and replace partial with final
						if (toolUseIndex !== undefined) {
							tsk.assistantMessageContent[toolUseIndex] = finalToolUse
						}

						// Clean up tracking
						tsk.streamingToolCallIndices.delete(event.id)

						// Mark that we have new content to process
						tsk.userMessageContentReady = false

						// Present the finalized tool call
						presentAssistantMessage(task)
					} else if (toolUseIndex !== undefined) {
						// finalizeStreamingToolCall returned null (malformed JSON or missing args)
						// Mark the tool as non-partial so it's presented as complete, but execution
						// will be short-circuited in presentAssistantMessage with a structured tool_result.
						const existingToolUse = tsk.assistantMessageContent[toolUseIndex]
						if (existingToolUse && existingToolUse.type === "tool_use") {
							existingToolUse.partial = false
							// Ensure it has the ID for native protocol
							;(existingToolUse as { id: string }).id = event.id
						}

						// Clean up tracking
						tsk.streamingToolCallIndices.delete(event.id)

						// Mark that we have new content to process
						tsk.userMessageContentReady = false

						// Present the tool call - validation will handle missing params
						presentAssistantMessage(task)
					}
				}
			}
		},

		tool_call: (chunk) => {
			// Legacy: Handle complete tool calls (for backward compatibility)
			// Convert native tool call to ToolUse format
			const toolUse = NativeToolCallParser.parseToolCall({
				id: chunk.id,
				name: chunk.name as ToolName,
				arguments: chunk.arguments,
			})

			if (!toolUse) {
				console.error(`Failed to parse tool call for task ${task.taskId}:`, chunk)
				return
			}

			// Store the tool call ID on the ToolUse object for later reference
			// This is needed to create tool_result blocks that reference the correct tool_use_id
			toolUse.id = chunk.id

			// Add the tool use to assistant message content
			tsk.assistantMessageContent.push(toolUse)

			// Mark that we have new content to process
			tsk.userMessageContentReady = false

			// Present the tool call to user - presentAssistantMessage will execute
			// tools sequentially and accumulate all results in userMessageContent
			presentAssistantMessage(task)
		},

		text: async (chunk) => {
			state.assistantMessage += chunk.text

			// Native tool calling: text chunks are plain text.
			// Create or update a text content block directly
			const lastBlock = tsk.assistantMessageContent[tsk.assistantMessageContent.length - 1] as any
			if (lastBlock?.type === "text" && lastBlock.partial) {
				lastBlock.text = state.assistantMessage
			} else {
				tsk.assistantMessageContent.push({
					type: "text",
					text: state.assistantMessage,
					partial: true,
				} as any)
				tsk.userMessageContentReady = false
			}
			presentAssistantMessage(task)

			// Phase 1: Sync assistant text to MST real-time
			const provider = task.providerRef.deref()
			if (provider && provider.chatStore) {
				const node = provider.chatStore.nodes.get(task.taskId)
				if (node) {
					node.updateApiMessage(task.instanceId + "_assistant", {
						role: "assistant",
						content: (state.reasoningMessage
							? [{ type: "reasoning", text: state.reasoningMessage } as any]
							: []
						).concat(tsk.assistantMessageContent),
					})
				}
			}
		},
	}
}

/**
 * Updates the API request message with token usage and cost data.
 */
export function updateApiReqMsg(
	task: Task,
	state: {
		inputTokens: number
		outputTokens: number
		cacheWriteTokens: number
		cacheReadTokens: number
		totalCost: number | undefined
		streamModelInfo: any
		lastApiReqIndex: number
		clineMessages: ClineMessage[]
	},
	cancelReason?: ClineApiReqCancelReason,
	streamingFailedMessage?: string,
): void {
	if (state.lastApiReqIndex < 0 || !state.clineMessages[state.lastApiReqIndex]) {
		return
	}

	const existingData = JSON.parse(state.clineMessages[state.lastApiReqIndex].text || "{}")

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
					state.streamModelInfo,
					state.inputTokens,
					state.outputTokens,
					state.cacheWriteTokens,
					state.cacheReadTokens,
				)
			: calculateApiCostOpenAI(
					state.streamModelInfo,
					state.inputTokens,
					state.outputTokens,
					state.cacheWriteTokens,
					state.cacheReadTokens,
				)

	task.clineMessages[state.lastApiReqIndex].text = JSON.stringify({
		...existingData,
		tokensIn: costResult.totalInputTokens,
		tokensOut: costResult.totalOutputTokens,
		cacheWrites: state.cacheWriteTokens,
		cacheReads: state.cacheReadTokens,
		cost: state.totalCost ?? costResult.totalCost,
		cancelReason,
		streamingFailedMessage,
	} satisfies ClineApiReqInfo)
}
