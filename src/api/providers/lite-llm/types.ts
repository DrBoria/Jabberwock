import OpenAI from "openai"

export type CacheableTextContent = OpenAI.Chat.ChatCompletionContentPartText & {
	cache_control?: { type: "ephemeral" }
}

// LiteLLM usage may include extra fields for various provider-specific cache tokens.
export interface LiteLLMUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	/** Anthropic-style prompt cache miss tokens (used by some LiteLLM proxy configurations) */
	prompt_cache_miss_tokens?: number
	/** LiteLLM field for cache read tokens (alternative naming) */
	cache_read_input_tokens?: number
	/** Anthropic-style prompt cache hit tokens (used by some LiteLLM proxy configurations) */
	prompt_cache_hit_tokens?: number
}
