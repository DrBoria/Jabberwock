import type { ModelInfo, ReasoningEffortExtended, ServiceTier, VerbosityLevel } from "@jabberwock/types"

export interface OpenAiNativeModel {
	id: string
	info: ModelInfo
	maxTokens?: number
	temperature?: number
	reasoning?: unknown
	format?: string
	verbosity?: VerbosityLevel
}

/**
 * Request body for OpenAI Responses API.
 */
export interface ResponsesRequestBody {
	model: string
	input: Array<
		| { role: "user" | "assistant"; content: Record<string, unknown>[] }
		| { type: string; content: string }
		| { type: string; call_id: string; output: string }
		| { type: string; call_id: string; name: string; arguments: string }
		| { type: "reasoning"; text: string }
	>
	stream: boolean
	reasoning?: { effort?: ReasoningEffortExtended; summary?: "auto" }
	text?: { verbosity: VerbosityLevel }
	temperature?: number
	max_output_tokens?: number
	store?: boolean
	instructions?: string
	service_tier?: ServiceTier
	include?: string[]
	prompt_cache_retention?: "in_memory" | "24h"
	tools?: Array<{
		type: "function"
		name: string
		description?: string
		parameters?: Record<string, unknown>
		strict?: boolean
	}>
	tool_choice?: unknown
	parallel_tool_calls?: boolean
}

/**
 * Typed interface for the OpenAI SDK's responses API.
 */
export interface ResponsesClient {
	responses: {
		create: (...args: unknown[]) => unknown
	}
}

/**
 * Raw usage object from OpenAI API responses.
 */
export interface RawUsage {
	input_tokens?: number
	output_tokens?: number
	prompt_tokens?: number
	completion_tokens?: number
	cache_creation_input_tokens?: number
	cache_write_tokens?: number
	cache_read_input_tokens?: number
	cache_read_tokens?: number
	cached_tokens?: number
	input_tokens_details?: Record<string, unknown>
	prompt_tokens_details?: Record<string, unknown>
	output_tokens_details?: Record<string, unknown>
}

/**
 * Extracts a reasoning conversation item from a message if it has type="reasoning".
 */
export function getReasoningConversationItem(message: unknown): { type: "reasoning"; text: string } | null {
	if (typeof message === "object" && message !== null && "type" in message) {
		const candidate = message as { type: string; text?: string }
		if (candidate.type === "reasoning" && typeof candidate.text === "string") {
			return { type: "reasoning" as const, text: candidate.text }
		}
	}
	return null
}

/**
 * Recursively processes a schema property, applying a transformation function
 * to nested object schemas and array-of-object schemas.
 */
export function processSchemaProp(
	prop: Record<string, unknown> | undefined,
	transform: (schema: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> {
	if (prop?.type === "object") {
		return transform(prop)
	}
	if (prop?.type === "array" && (prop.items as Record<string, unknown> | undefined)?.type === "object") {
		return { ...prop, items: transform(prop.items as Record<string, unknown>) }
	}
	return prop ?? {}
}
