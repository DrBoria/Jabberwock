import OpenAI from "openai"

import { hasCloudService, getCloudService } from "@jabberwock/cloud"

import type { RooReasoningParams } from "@api/transform/content/reasoning"

// Extend OpenAI's CompletionUsage to include Jabberwock specific fields
export interface RooUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	cost?: number
}

// Add custom interface for Jabberwock params to support reasoning
export type RooChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
	reasoning?: RooReasoningParams
}

export interface ReasoningDetailInput {
	type: string
	text?: string
	summary?: string
	data?: string
	id?: string | null
	format?: string
	signature?: string
	index?: number
}

export interface ReasoningDetailValue {
	type: string
	text?: string
	summary?: string
	data?: string
	id?: string | null
	format?: string
	signature?: string
	index: number
}

export type StreamYield =
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
	| {
			type: "usage"
			inputTokens: number
			outputTokens: number
			cacheWriteTokens: number
			cacheReadTokens: number
			totalCost: number
	  }

export interface ReasoningYieldsResult {
	yields: StreamYield[]
	hasYieldedReasoning: boolean
}

export interface StreamChunkResult {
	yields: StreamYield[]
	hasYieldedReasoning: boolean
	lastUsage: RooUsage | undefined
}

export function getSessionToken(): string {
	const token = hasCloudService() ? getCloudService().authService?.getSessionToken() : undefined
	return token ?? "unauthenticated"
}
