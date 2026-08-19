import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ConvertToOpenAiMessagesOptions, AnthropicMessageWithReasoning } from "@api/transform/openai-format-types"
import {
	processStringContent,
	processArrayContentUser,
	processArrayContentAssistant,
} from "@api/transform/content/processors"

export function convertToOpenAiMessages(
	anthropicMessages: Anthropic.Messages.MessageParam[],
	options?: ConvertToOpenAiMessagesOptions,
): OpenAI.Chat.ChatCompletionMessageParam[] {
	const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
	const normalizeId = options?.normalizeToolCallId ?? ((id: string) => id)
	const mergeToolResultText = options?.mergeToolResultText

	for (const anthropicMessage of anthropicMessages) {
		if (typeof anthropicMessage.content === "string") {
			const messageWithDetails = anthropicMessage as AnthropicMessageWithReasoning
			openAiMessages.push(
				processStringContent(
					anthropicMessage.content,
					anthropicMessage.role,
					messageWithDetails.reasoning_details,
				),
			)
			continue
		}

		if (anthropicMessage.role === "user") {
			processArrayContentUser(anthropicMessage.content, normalizeId, mergeToolResultText, openAiMessages)
		} else if (anthropicMessage.role === "assistant") {
			processArrayContentAssistant(anthropicMessage.content, normalizeId, anthropicMessage, openAiMessages)
		}
	}

	return openAiMessages
}
