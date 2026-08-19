import OpenAI from "openai"
import { z } from "zod"

import type { OpenRouterReasoningParams } from "@api/transform/content/reasoning"

// Add custom interface for OpenRouter params.
export type OpenRouterChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParams & {
	transforms?: string[]
	include_reasoning?: boolean
	// https://openrouter.ai/docs/use-cases/reasoning-tokens
	reasoning?: OpenRouterReasoningParams
}

// Zod schema for OpenRouter error response structure (for caught exceptions)
export const OpenRouterErrorResponseSchema = z.object({
	error: z
		.object({
			message: z.string().optional(),
			code: z.number().optional(),
			metadata: z
				.object({
					raw: z.string().optional(),
				})
				.optional(),
		})
		.optional(),
})

// OpenRouter error structure that may include error.metadata.raw with actual upstream error
// This is for caught exceptions which have the error wrapped in an "error" property

export interface OpenRouterErrorResponse {
	error?: {
		message?: string
		code?: number
		metadata?: { raw?: string }
	}
}

// Direct error object structure (for streaming errors passed directly)
export interface OpenRouterError {
	message?: string
	code?: number
	metadata?: { raw?: string }
}

// See `OpenAI.Chat.Completions.ChatCompletionChunk["usage"]`
// `CompletionsAPI.CompletionUsage`
// See also: https://openrouter.ai/docs/use-cases/usage-accounting
export interface CompletionUsage {
	completion_tokens?: number
	completion_tokens_details?: {
		reasoning_tokens?: number
	}
	prompt_tokens?: number
	prompt_tokens_details?: {
		cached_tokens?: number
	}
	total_tokens?: number
	cost?: number
	cost_details?: {
		upstream_inference_cost?: number
	}
}

/**
 * Helper function to parse and extract error message from metadata.raw
 * metadata.raw is often a JSON encoded string that may contain .message or .error fields
 * Example structures:
 * - {"message": "Error text"}
 * - {"error": "Error text"}
 * - {"error": {"message": "Error text"}}
 * - {"type":"error","error":{"type":"invalid_request_error","message":"tools: Tool names must be unique."}}
 */
export function extractErrorFromMetadataRaw(raw: string | undefined): string | undefined {
	if (!raw) {
		return undefined
	}

	try {
		const parsed = JSON.parse(raw)
		// Check for common error message fields
		if (typeof parsed === "object" && parsed !== null) {
			// Check for direct message field
			if (typeof parsed.message === "string") {
				return parsed.message
			}
			// Check for nested error.message field (e.g., Anthropic error format)
			if (typeof parsed.error === "object" && parsed.error !== null && typeof parsed.error.message === "string") {
				return parsed.error.message
			}
			// Check for error as a string
			if (typeof parsed.error === "string") {
				return parsed.error
			}
		}
		// If we can't extract a specific field, return the raw string
		return raw
	} catch {
		// If it's not valid JSON, return as-is
		return raw
	}
}
