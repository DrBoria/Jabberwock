export interface RawUsage {
	prompt_tokens?: number
	completion_tokens?: number
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
	prompt_tokens_details?: {
		cache_write_tokens?: number
		cached_tokens?: number
	}
	completion_tokens_details?: {
		reasoning_tokens?: number
	}
}

export function extractOpenAiCacheMetrics(usage: RawUsage | undefined): {
	cacheWriteTokens: number | undefined
	cacheReadTokens: number | undefined
} {
	if (!usage) {
		return { cacheWriteTokens: undefined, cacheReadTokens: undefined }
	}
	if (usage.cache_creation_input_tokens !== undefined || usage.cache_read_input_tokens !== undefined) {
		return {
			cacheWriteTokens: usage.cache_creation_input_tokens,
			cacheReadTokens: usage.cache_read_input_tokens,
		}
	}
	if (usage.prompt_tokens_details) {
		return {
			cacheWriteTokens: usage.prompt_tokens_details.cache_write_tokens,
			cacheReadTokens: usage.prompt_tokens_details.cached_tokens,
		}
	}
	return { cacheWriteTokens: undefined, cacheReadTokens: undefined }
}
