import { Anthropic } from "@anthropic-ai/sdk"
import type { ApiMessage, ReasoningBlockFields, ReasoningItemForRequest } from "./saveApiMessages.types"

export function buildCleanConversationHistory(
	preserveReasoning: boolean,
	messages: ApiMessage[],
): Array<Anthropic.Messages.MessageParam | ReasoningItemForRequest> {
	const cleanConversationHistory: (Anthropic.Messages.MessageParam | ReasoningItemForRequest)[] = []

	for (const msg of messages) {
		if (msg.type === "reasoning") {
			processReasoningMessage(msg, cleanConversationHistory)
			continue
		}

		if (msg.role === "assistant") {
			processAssistantMessage(msg, preserveReasoning, cleanConversationHistory)
			continue
		}

		if (msg.role) {
			cleanConversationHistory.push({
				role: msg.role,
				content: msg.content as Anthropic.Messages.ContentBlockParam[] | string,
			})
		}
	}

	return cleanConversationHistory
}

function processReasoningMessage(
	msg: ApiMessage,
	history: (Anthropic.Messages.MessageParam | ReasoningItemForRequest)[],
): void {
	if (!msg.encrypted_content) {
		return
	}

	history.push({
		type: "reasoning",
		summary: msg.summary,
		encrypted_content: msg.encrypted_content!,
		...(msg.id ? { id: msg.id } : {}),
	})
}

function buildContentArray(rawContent: ApiMessage["content"]): Anthropic.Messages.ContentBlockParam[] {
	if (Array.isArray(rawContent)) {
		return rawContent as Anthropic.Messages.ContentBlockParam[]
	}

	if (rawContent !== undefined) {
		return [
			{ type: "text", text: rawContent } satisfies Anthropic.Messages.TextBlockParam,
		] as Anthropic.Messages.ContentBlockParam[]
	}

	return []
}

function extractReasoningDetails(msg: ApiMessage): Anthropic.Messages.MessageParam["content"] | undefined {
	return (msg as { reasoning_details?: Anthropic.Messages.MessageParam["content"] }).reasoning_details
}

function selectAssistantHandlerKey(
	hasReasoningDetails: boolean,
	hasEncryptedReasoning: boolean,
	hasPlainTextReasoning: boolean,
): string {
	if (hasReasoningDetails) {
		return "reasoning_details"
	}

	if (hasEncryptedReasoning) {
		return "encrypted_reasoning"
	}

	if (hasPlainTextReasoning) {
		return "plain_text_reasoning"
	}

	return "default"
}

function pushAssistantToHistory(
	history: (Anthropic.Messages.MessageParam | ReasoningItemForRequest)[],
	reasoningItem: ReasoningItemForRequest | undefined,
	handlerKey: string,
	assistantContent: Anthropic.Messages.MessageParam["content"],
	reasoningDetails: Anthropic.Messages.MessageParam["content"] | undefined,
): void {
	if (reasoningItem) {
		history.push(reasoningItem)
	}

	if (handlerKey === "reasoning_details") {
		history.push({
			role: "assistant",
			content: assistantContent,
			reasoning_details: reasoningDetails as Anthropic.Messages.MessageParam["content"],
		} as Anthropic.Messages.MessageParam & {
			reasoning_details: Anthropic.Messages.MessageParam["content"]
		})
	} else {
		history.push({
			role: "assistant",
			content: assistantContent,
		} satisfies Anthropic.Messages.MessageParam)
	}
}

function processAssistantMessage(
	msg: ApiMessage,
	preserveReasoning: boolean,
	history: (Anthropic.Messages.MessageParam | ReasoningItemForRequest)[],
): void {
	const contentArray = buildContentArray(msg.content)
	const [first, ...rest] = contentArray

	const reasoningDetails = extractReasoningDetails(msg)
	const hasReasoningDetails = Array.isArray(reasoningDetails)
	const firstAsReasoningBlock = first as { type: string } | undefined
	const hasEncryptedReasoning =
		firstAsReasoningBlock?.type === "reasoning" &&
		typeof (first as ReasoningBlockFields).encrypted_content === "string"
	const hasPlainTextReasoning =
		firstAsReasoningBlock?.type === "reasoning" && typeof (first as ReasoningBlockFields).text === "string"

	const handlerKey = selectAssistantHandlerKey(hasReasoningDetails, hasEncryptedReasoning, hasPlainTextReasoning)

	const assistantHandlers: Record<
		string,
		() => {
			reasoningItem?: ReasoningItemForRequest
			assistantContent: Anthropic.Messages.MessageParam["content"]
		}
	> = {
		reasoning_details: () => handleReasoningDetails(contentArray),
		encrypted_reasoning: () => handleEncryptedReasoning(first, rest),
		plain_text_reasoning: () => handlePlainTextReasoning(preserveReasoning, contentArray, rest),
		default: () => ({ assistantContent: contentArray }),
	}

	const handler = assistantHandlers[handlerKey]
	const { reasoningItem, assistantContent } = handler()

	pushAssistantToHistory(history, reasoningItem, handlerKey, assistantContent, reasoningDetails)
}

function handleReasoningDetails(contentArray: Anthropic.Messages.ContentBlockParam[]): {
	assistantContent: Anthropic.Messages.MessageParam["content"]
} {
	let assistantContent: Anthropic.Messages.MessageParam["content"]

	if (contentArray.length === 0) {
		assistantContent = ""
	} else if (contentArray.length === 1 && contentArray[0].type === "text") {
		assistantContent = (contentArray[0] as Anthropic.Messages.TextBlockParam).text
	} else {
		assistantContent = contentArray
	}

	return { assistantContent }
}

function handleEncryptedReasoning(
	first: Anthropic.Messages.ContentBlockParam | undefined,
	rest: Anthropic.Messages.ContentBlockParam[],
): { reasoningItem?: ReasoningItemForRequest; assistantContent: Anthropic.Messages.MessageParam["content"] } {
	const reasoningBlock = first as ReasoningBlockFields | undefined

	const reasoningItem: ReasoningItemForRequest = {
		type: "reasoning",
		summary: reasoningBlock?.summary ?? [],
		encrypted_content: reasoningBlock?.encrypted_content ?? "",
		...(reasoningBlock?.id ? { id: reasoningBlock.id } : {}),
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
}

function handlePlainTextReasoning(
	preserveReasoning: boolean,
	contentArray: Anthropic.Messages.ContentBlockParam[],
	rest: Anthropic.Messages.ContentBlockParam[],
): { assistantContent: Anthropic.Messages.MessageParam["content"] } {
	let assistantContent: Anthropic.Messages.MessageParam["content"]

	if (preserveReasoning) {
		assistantContent = contentArray
	} else if (rest.length === 0) {
		assistantContent = ""
	} else if (rest.length === 1 && rest[0].type === "text") {
		assistantContent = (rest[0] as Anthropic.Messages.TextBlockParam).text
	} else {
		assistantContent = rest
	}

	return { assistantContent }
}
