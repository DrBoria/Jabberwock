import crypto from "crypto"
import { Anthropic } from "@anthropic-ai/sdk"
import { getApiProtocol, getModelId, isRetiredProvider } from "@jabberwock/types"
import { getEffectiveApiHistory } from "../../../../condense"
import { validateAndFixToolResultIds } from "../../../../task/validateToolResultIds"
import { Task } from "../../../../task/Task"

/**
 * Add a message to the API conversation history, handling reasoning blocks,
 * thought signatures, and tool_result validation.
 *
 * @param task - The Task instance
 * @param message - The message to add to the conversation history
 * @param reasoning - Optional reasoning text (for thinking/reasoning blocks)
 */
export async function addToApiConversationHistory(task: Task, message: Anthropic.MessageParam, reasoning?: string) {
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
		const messageWithTs: any = {
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

		task.apiConversationHistory.push(messageWithTs)
	} else {
		// For user messages, validate tool_result IDs ONLY when the immediately previous *effective* message
		// is an assistant message.
		//
		// If the previous effective message is also a user message (e.g., summary + a new user message),
		// validating against any earlier assistant message can incorrectly inject placeholder tool_results.
		const effectiveHistoryForValidation = getEffectiveApiHistory(task.apiConversationHistory)
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
		task.apiConversationHistory.push(messageWithTs)
	}

	// Phase 4: Push to ChatStore
	const providerInstance = task.providerRef.deref()
	if (providerInstance && providerInstance.chatStore) {
		const node = providerInstance.chatStore.nodes.get(task.taskId)
		if (node) {
			const lastMsg = task.apiConversationHistory[task.apiConversationHistory.length - 1]
			node.addMessage({
				id: lastMsg.id || crypto.randomUUID(),
				role: lastMsg.role,
				content: lastMsg,
				ts: lastMsg.ts || task.generateUniqueTs(),
			})
		}
	}

	await task.saveApiConversationHistory()
}
