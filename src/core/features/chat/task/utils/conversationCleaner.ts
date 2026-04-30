import { Anthropic } from "@anthropic-ai/sdk"
import { ApiMessage } from "../../../../task-persistence"
import { Task } from "../../../../task/Task"

type ReasoningItemForRequest = {
	type: "reasoning"
	encrypted_content: string
	id?: string
	summary?: any[]
}

/**
 * Build a clean conversation history from stored API messages, handling
 * reasoning blocks, encrypted content, and thought signatures.
 *
 * @param task - The Task instance
 * @param messages - The stored API messages to clean
 * @returns Array of cleaned messages suitable for API requests
 */
export function buildCleanConversationHistory(
	task: Task,
	messages: ApiMessage[],
): Array<
	Anthropic.Messages.MessageParam | { type: "reasoning"; encrypted_content: string; id?: string; summary?: any[] }
> {
	const cleanConversationHistory: (Anthropic.Messages.MessageParam | ReasoningItemForRequest)[] = []

	for (const msg of messages) {
		// Standalone reasoning: send encrypted, skip plain text
		if (msg.type === "reasoning") {
			if (msg.encrypted_content) {
				cleanConversationHistory.push({
					type: "reasoning",
					summary: msg.summary,
					encrypted_content: msg.encrypted_content!,
					...(msg.id ? { id: msg.id } : {}),
				})
			}
			continue
		}

		// Preferred path: assistant message with embedded reasoning as first content block
		if (msg.role === "assistant") {
			const rawContent = msg.content

			const contentArray: Anthropic.Messages.ContentBlockParam[] = Array.isArray(rawContent)
				? (rawContent as Anthropic.Messages.ContentBlockParam[])
				: rawContent !== undefined
					? ([
							{ type: "text", text: rawContent } satisfies Anthropic.Messages.TextBlockParam,
						] as Anthropic.Messages.ContentBlockParam[])
					: []

			const [first, ...rest] = contentArray

			// Check if this message has reasoning_details (OpenRouter format for Gemini 3, etc.)
			const msgWithDetails = msg as any
			const hasReasoningDetails =
				msgWithDetails.reasoning_details && Array.isArray(msgWithDetails.reasoning_details)

			// Embedded reasoning: encrypted (send) or plain text (skip)
			const hasEncryptedReasoning =
				first && (first as any).type === "reasoning" && typeof (first as any).encrypted_content === "string"
			const hasPlainTextReasoning =
				first && (first as any).type === "reasoning" && typeof (first as any).text === "string"

			// Determine the assistant message handler based on content type
			const assistantHandlers: Record<
				string,
				() => {
					reasoningItem?: ReasoningItemForRequest
					assistantContent: Anthropic.Messages.MessageParam["content"]
				}
			> = {
				reasoning_details: () => {
					let assistantContent: Anthropic.Messages.MessageParam["content"]

					if (contentArray.length === 0) {
						assistantContent = ""
					} else if (contentArray.length === 1 && contentArray[0].type === "text") {
						assistantContent = (contentArray[0] as Anthropic.Messages.TextBlockParam).text
					} else {
						assistantContent = contentArray
					}

					return { assistantContent }
				},
				encrypted_reasoning: () => {
					const reasoningBlock = first as any

					const reasoningItem: ReasoningItemForRequest = {
						type: "reasoning",
						summary: reasoningBlock.summary ?? [],
						encrypted_content: reasoningBlock.encrypted_content,
						...(reasoningBlock.id ? { id: reasoningBlock.id } : {}),
					}

					let assistantContent: Anthropic.Messages.MessageParam["content"]

					if (rest.length === 0) {
						assistantContent = ""
					} else if (rest.length === 1 && rest[0].type === "text") {
						assistantContent = (rest[0] as Anthropic.Messages.TextBlockParam).text
					} else {
						assistantContent = rest
					}

					return { reasoningItem, assistantContent }
				},
				plain_text_reasoning: () => {
					const shouldPreserveForApi = task.api.getModel().info.preserveReasoning === true
					let assistantContent: Anthropic.Messages.MessageParam["content"]

					if (shouldPreserveForApi) {
						assistantContent = contentArray
					} else {
						if (rest.length === 0) {
							assistantContent = ""
						} else if (rest.length === 1 && rest[0].type === "text") {
							assistantContent = (rest[0] as Anthropic.Messages.TextBlockParam).text
						} else {
							assistantContent = rest
						}
					}

					return { assistantContent }
				},
				default: () => {
					return { assistantContent: contentArray }
				},
			}

			// Select the appropriate handler key
			let handlerKey: string
			if (hasReasoningDetails) {
				handlerKey = "reasoning_details"
			} else if (hasEncryptedReasoning) {
				handlerKey = "encrypted_reasoning"
			} else if (hasPlainTextReasoning) {
				handlerKey = "plain_text_reasoning"
			} else {
				handlerKey = "default"
			}

			const handler = assistantHandlers[handlerKey]
			const { reasoningItem, assistantContent } = handler()

			if (reasoningItem) {
				cleanConversationHistory.push(reasoningItem)
			}

			if (handlerKey === "reasoning_details") {
				cleanConversationHistory.push({
					role: "assistant",
					content: assistantContent,
					reasoning_details: msgWithDetails.reasoning_details,
				} as any)
			} else {
				cleanConversationHistory.push({
					role: "assistant",
					content: assistantContent,
				} satisfies Anthropic.Messages.MessageParam)
			}

			continue
		}

		// Default path for regular messages (no embedded reasoning)
		if (msg.role) {
			cleanConversationHistory.push({
				role: msg.role,
				content: msg.content as Anthropic.Messages.ContentBlockParam[] | string,
			})
		}
	}

	return cleanConversationHistory
}
