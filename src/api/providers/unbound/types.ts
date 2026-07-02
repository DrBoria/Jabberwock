import OpenAI from "openai"

import { OpenAiReasoningParams } from "@api/transform/content/reasoning"

export interface UnboundUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
}

export type UnboundChatCompletionParamsStreaming = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & {
	unbound_metadata?: {
		originApp?: string
		taskId?: string
		mode?: string
	}
	thinking?: OpenAiReasoningParams
}

export type UnboundChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParams & {
	unbound_metadata?: {
		originApp?: string
		taskId?: string
		mode?: string
	}
	thinking?: OpenAiReasoningParams
}
