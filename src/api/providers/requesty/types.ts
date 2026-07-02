import OpenAI from "openai"

import { AnthropicReasoningParams } from "@api/transform/content/reasoning"

// Requesty usage includes an extra field for Anthropic use cases.
// Safely cast the prompt token details section to the appropriate structure.
export interface RequestyUsage extends OpenAI.CompletionUsage {
	prompt_tokens_details?: {
		caching_tokens?: number
		cached_tokens?: number
	}
	total_cost?: number
}

export type RequestyChatCompletionParamsStreaming = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & {
	requesty?: {
		trace_id?: string
		extra?: {
			mode?: string
		}
	}
	thinking?: AnthropicReasoningParams
}

export type RequestyChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParams & {
	requesty?: {
		trace_id?: string
		extra?: {
			mode?: string
		}
	}
	thinking?: AnthropicReasoningParams
}
