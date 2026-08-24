import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Type for OpenRouter's reasoning detail elements.
 * @see https://openrouter.ai/docs/use-cases/reasoning-tokens#streaming-response
 */
export type ReasoningDetail = {
	/**
	 * Type of reasoning detail.
	 * @see https://openrouter.ai/docs/use-cases/reasoning-tokens#reasoning-detail-types
	 */
	type: string // "reasoning.summary" | "reasoning.encrypted" | "reasoning.text"
	text?: string
	summary?: string
	data?: string // Encrypted reasoning data
	signature?: string | null
	id?: string | null // Unique identifier for the reasoning detail
	/**
	 * Format of the reasoning detail:
	 * - "unknown" - Format is not specified
	 * - "openai-responses-v1" - OpenAI responses format version 1
	 * - "anthropic-claude-v1" - Anthropic Claude format version 1 (default)
	 * - "google-gemini-v1" - Google Gemini format version 1
	 * - "xai-responses-v1" - xAI responses format version 1
	 */
	format?: string
	index?: number // Sequential index of the reasoning detail
}

export type GroupMetadata = {
	text: string
	summary: string
	signature: string | undefined
	id: string | undefined
	format: string
	type: string
}

export type ContentSplitResult = {
	nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
	toolMessages: Anthropic.ToolResultBlockParam[]
}

export type ToolCallSplitResult = {
	nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
	toolMessages: Anthropic.ToolUseBlockParam[]
}

/**
 * Anthropic MessageParam extended with optional reasoning_details.
 * Used by upstream transforms (e.g. Task.buildCleanConversationHistory) to attach
 * Gemini 3 / xAI / o-series reasoning details to messages.
 */
export interface AnthropicMessageWithReasoning extends Anthropic.Messages.MessageParam {
	reasoning_details?: ReasoningDetail[]
}

/**
 * Options for converting Anthropic messages to OpenAI format.
 */
export interface ConvertToOpenAiMessagesOptions {
	/**
	 * Optional function to normalize tool call IDs for providers with strict ID requirements.
	 * When provided, this function will be applied to all tool_use IDs and tool_result tool_use_ids.
	 * This allows callers to declare provider-specific ID format requirements.
	 */
	normalizeToolCallId?: (id: string) => string
	/**
	 * If true, merge text content after tool_results into the last tool message
	 * instead of creating a separate user message. This is critical for providers
	 * with reasoning/thinking models (like DeepSeek-reasoner, GLM-4.7, etc.) where
	 * a user message after tool results causes the model to drop all previous
	 * reasoning_content. Default is false for backward compatibility.
	 */
	mergeToolResultText?: boolean
}
