import crypto from "crypto"
import delay from "delay"
import { Anthropic } from "@anthropic-ai/sdk"
import { getApiProtocol, getModelId, isRetiredProvider } from "@jabberwock/types"
import { type ApiMessage, readApiConversation, saveApiMessages } from "."
import { getTask } from "../../actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import { getEffectiveApiHistory } from "../../condense/handlers/on-context-condense"
import { validateAndFixToolResultIds } from "../../../tools/actions/validateToolResultIds"

import type { ITaskModel } from "../../store"

/**
 * Save the API conversation history to disk.
 * Reads history from per-task MST store.
 */
export async function saveApiConversationHistory(taskId: string, globalStoragePath: string): Promise<boolean> {
	try {
		const history = getBackendRootStore().chat.tasks.get(taskId)!.apiConversationHistory as ApiMessage[]
		await saveApiMessages({
			messages: structuredClone(history),
			taskId,
			globalStoragePath,
		})
		return true
	} catch (error) {
		console.error("[jabberwock] Failed to save API conversation history:", error)
		return false
	}
}

/**
 * Public wrapper to retry saving the API conversation history.
 * Uses exponential backoff: up to 3 attempts with delays of 100 ms, 500 ms, 1500 ms.
 */
export async function retrySaveApiConversationHistory(taskId: string): Promise<boolean> {
	const task = getTask(taskId)
	const delays = [100, 500, 1500]

	for (let attempt = 0; attempt < delays.length; attempt++) {
		await delay(delays[attempt])
		console.warn(
			`[Task#${task.taskId}] retrySaveApiConversationHistory: retry attempt ${attempt + 1}/${delays.length}`,
		)

		try {
			await saveApiConversationHistory(task.taskId, task.globalStoragePath)
			return true
		} catch (err) {
			console.warn(`[Task#${task.taskId}] retrySaveApiConversationHistory failed:`, err)
		}
	}

	return false
}

/**
 * Gets saved API conversation history from disk.
 */
export async function getSavedApiConversationHistory(taskId: string, globalStoragePath: string): Promise<ApiMessage[]> {
	return readApiConversation({ taskId, globalStoragePath })
}

/**
 * Add a message to the API conversation history, handling reasoning blocks,
 * thought signatures, and tool_result validation.
 *
 * Messages are pushed to the MST store (messages.apiConversationHistory)
 * and persisted to disk.
 */
export async function addToApiConversationHistory(
	taskId: string,
	globalStoragePath: string,
	task: ITaskModel,
	message: Anthropic.MessageParam,
	reasoning?: string,
) {
	// Capture the encrypted_content / thought signatures from the provider (e.g., OpenAI Responses API, Google GenAI) if present.
	// We only persist data reported by the current response body.
	const handler = task.api as {
		getResponseId?: () => string | undefined
		getEncryptedContent?: () => { encrypted_content: string; id?: string } | undefined
		getThoughtSignature?: () => string | undefined
		getSummary?: () => unknown[] | undefined
		getReasoningDetails?: () => unknown[] | undefined
	}

	if (message.role === "assistant") {
		const responseId = handler.getResponseId?.()
		const reasoningData = handler.getEncryptedContent?.()
		const thoughtSignature = handler.getThoughtSignature?.()
		const reasoningSummary = handler.getSummary?.()
		const reasoningDetails = handler.getReasoningDetails?.()

		// Only Anthropic's API expects/validates the special `thinking` content block signature.
		// Other providers (notably Gemini 3) use different signature semantics (e.g. `thoughtSignature`)
		// and require round-tripping the signature in their own format.
		const modelId = getModelId(task.apiConfiguration)
		const apiProvider = task.apiConfiguration.apiProvider
		const apiProtocol = getApiProtocol(
			apiProvider && !isRetiredProvider(apiProvider) ? apiProvider : undefined,
			modelId,
		)
		const isAnthropicProtocol = apiProtocol === "anthropic"

		// Start from the original assistant message
		// We cast to any to allow dynamic property assignment (ts, id, reasoning_details)
		// without violating strict SDK types during construction.
		const messageWithTs: { [key: string]: unknown } = {
			...message,
			...(responseId ? { id: responseId } : {}),
			ts: task.generateUniqueTs(),
		}

		// Store reasoning_details array if present (for models like Gemini 3)
		if (reasoningDetails) {
			messageWithTs.reasoning_details = reasoningDetails
		}

		// Store reasoning: Anthropic thinking (with signature), plain text (most providers), or encrypted (OpenAI Native)
		// Skip if reasoning_details already contains the reasoning (to avoid duplication)
		if (isAnthropicProtocol && reasoning && thoughtSignature && !reasoningDetails) {
			// Anthropic provider with extended thinking: Store as proper `thinking` block
			// This format passes through anthropic-filter.ts and is properly round-tripped
			// for interleaved thinking with tool use (required by Anthropic API)
			const thinkingBlock = {
				type: "thinking" as const,
				thinking: reasoning,
				signature: thoughtSignature,
			}

			if (typeof messageWithTs.content === "string") {
				messageWithTs.content = [
					thinkingBlock,
					{ type: "text", text: messageWithTs.content } satisfies Anthropic.Messages.TextBlockParam,
				]
			} else if (Array.isArray(messageWithTs.content)) {
				messageWithTs.content = [thinkingBlock, ...messageWithTs.content]
			} else if (!messageWithTs.content) {
				messageWithTs.content = [thinkingBlock]
			}
		} else if (reasoning && !reasoningDetails) {
			// Other providers (non-Anthropic): Store as generic reasoning block
			const reasoningBlock = {
				type: "reasoning" as const,
				text: reasoning,
				summary: reasoningSummary ?? undefined,
			}

			if (typeof messageWithTs.content === "string") {
				messageWithTs.content = [
					reasoningBlock,
					{ type: "text", text: messageWithTs.content } satisfies Anthropic.Messages.TextBlockParam,
				]
			} else if (Array.isArray(messageWithTs.content)) {
				messageWithTs.content = [reasoningBlock, ...messageWithTs.content]
			} else if (!messageWithTs.content) {
				messageWithTs.content = [reasoningBlock]
			}
		} else if (reasoningData?.encrypted_content) {
			// OpenAI Native encrypted reasoning
			const reasoningBlock = {
				type: "reasoning" as const,
				summary: undefined,
				encrypted_content: reasoningData.encrypted_content,
				...(reasoningData.id ? { id: reasoningData.id } : {}),
			}

			if (typeof messageWithTs.content === "string") {
				messageWithTs.content = [
					reasoningBlock,
					{ type: "text", text: messageWithTs.content } satisfies Anthropic.Messages.TextBlockParam,
				]
			} else if (Array.isArray(messageWithTs.content)) {
				messageWithTs.content = [reasoningBlock, ...messageWithTs.content]
			} else if (!messageWithTs.content) {
				messageWithTs.content = [reasoningBlock]
			}
		}

		// For non-Anthropic providers (e.g., Gemini 3), persist the thought signature as its own
		// content block so converters can attach it back to the correct provider-specific fields.
		// Note: For Anthropic extended thinking, the signature is already included in the thinking block above.
		if (thoughtSignature && !isAnthropicProtocol) {
			const thoughtSignatureBlock = {
				type: "thoughtSignature" as const,
				thoughtSignature,
			}

			if (typeof messageWithTs.content === "string") {
				messageWithTs.content = [
					{ type: "text", text: messageWithTs.content } satisfies Anthropic.Messages.TextBlockParam,
					thoughtSignatureBlock,
				]
			} else if (Array.isArray(messageWithTs.content)) {
				messageWithTs.content = [...messageWithTs.content, thoughtSignatureBlock]
			} else if (!messageWithTs.content) {
				messageWithTs.content = [thoughtSignatureBlock]
			}
		}

		// Phase 4: Push to MST store instead of task.apiConversationHistory
		const store = getBackendRootStore().chat.tasks.get(taskId)!
		store.apiConversationHistory.push(messageWithTs as { [key: string]: unknown } & ApiMessage)
	} else {
		// For user messages, validate tool_result IDs ONLY when the immediately previous *effective* message
		// is an assistant message.
		//
		// If the previous effective message is also a user message (e.g., summary + a new user message),
		// validating against any earlier assistant message can incorrectly inject placeholder tool_results.
		const store = getBackendRootStore().chat.tasks.get(taskId)!
		const apiHistory = [...store.apiConversationHistory]
		const effectiveHistoryForValidation = getEffectiveApiHistory(apiHistory)
		const lastEffective = effectiveHistoryForValidation[effectiveHistoryForValidation.length - 1]
		const historyForValidation = lastEffective?.role === "assistant" ? effectiveHistoryForValidation : []

		// If the previous effective message is NOT an assistant, convert tool_result blocks to text blocks.
		// This prevents orphaned tool_results from being filtered out by getEffectiveApiHistory.
		// This can happen when condensing occurs after the assistant sends tool_uses but before
		// the user responds - the tool_use blocks get condensed away, leaving orphaned tool_results.
		let messageToAdd = message
		if (lastEffective?.role !== "assistant" && Array.isArray(message.content)) {
			messageToAdd = {
				...message,
				content: message.content.map((block) =>
					block.type === "tool_result"
						? {
								type: "text" as const,
								text: `Tool result:\n${typeof block.content === "string" ? block.content : JSON.stringify(block.content)}`,
							}
						: block,
				),
			}
		}

		const validatedMessage = validateAndFixToolResultIds(messageToAdd, historyForValidation)
		const messageWithTs = { ...validatedMessage, ts: task.generateUniqueTs() }

		// Phase 4: Push to MST store instead of task.apiConversationHistory
		store.apiConversationHistory.push(messageWithTs as { [key: string]: unknown } & ApiMessage)
	}

	// Phase 4: Persist to disk via MST store-backed function
	await saveApiConversationHistory(taskId, globalStoragePath)
}
