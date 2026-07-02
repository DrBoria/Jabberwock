import type OpenAI from "openai"

import type { ApiStreamChunk } from "@api/transform/stream"

import type { CompletionUsage } from "./types"
import { consolidateReasoningDetails } from "@api/transform/content/consolidate-reasoning"
import type { ReasoningDetail } from "@api/transform/openai-format-types"

export interface StreamContext {
	hasYieldedReasoningFromDetails: boolean
	reasoningDetailsAccumulator: Map<
		string,
		{
			type: string
			text?: string
			summary?: string
			data?: string
			id?: string | null
			format?: string
			signature?: string
			index: number
		}
	>
}

export function createStreamContext(): StreamContext {
	return {
		hasYieldedReasoningFromDetails: false,
		reasoningDetailsAccumulator: new Map(),
	}
}

function updateExistingDetail(
	existing: {
		type: string
		text?: string
		summary?: string
		data?: string
		id?: string | null
		format?: string
		signature?: string
		index: number
	},
	detail: {
		text?: string
		summary?: string
		data?: string
		id?: string | null
		format?: string
		signature?: string
	},
): void {
	if (detail.text !== undefined) {
		existing.text = (existing.text || "") + detail.text
	}
	if (detail.summary !== undefined) {
		existing.summary = (existing.summary || "") + detail.summary
	}
	if (detail.data !== undefined) {
		existing.data = (existing.data || "") + detail.data
	}
	if (detail.id !== undefined) existing.id = detail.id
	if (detail.format !== undefined) existing.format = detail.format
	if (detail.signature !== undefined) existing.signature = detail.signature
}

function extractReasoningText(type: string, text?: string, summary?: string): string | undefined {
	if (type === "reasoning.text" && typeof text === "string") {
		return text
	}
	if (type === "reasoning.summary" && typeof summary === "string") {
		return summary
	}
	return undefined
}

function handleSingleReasoningDetail(
	detail: {
		type: string
		text?: string
		summary?: string
		data?: string
		id?: string | null
		format?: string
		signature?: string
		index?: number
	},
	ctx: StreamContext,
	results: ApiStreamChunk[],
): void {
	const index = detail.index ?? 0
	const key = `${detail.type}-${index}`
	const existing = ctx.reasoningDetailsAccumulator.get(key)

	if (existing) {
		updateExistingDetail(existing, detail)
	} else {
		ctx.reasoningDetailsAccumulator.set(key, {
			type: detail.type,
			text: detail.text,
			summary: detail.summary,
			data: detail.data,
			id: detail.id,
			format: detail.format,
			signature: detail.signature,
			index,
		})
	}

	const reasoningText = extractReasoningText(detail.type, detail.text, detail.summary)
	if (reasoningText) {
		ctx.hasYieldedReasoningFromDetails = true
		results.push({ type: "reasoning", text: reasoningText })
	}
}

function processReasoningDetails(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta & {
		reasoning_details?: Array<{
			type: string
			text?: string
			summary?: string
			data?: string
			id?: string | null
			format?: string
			signature?: string
			index?: number
		}>
	},
	ctx: StreamContext,
	results: ApiStreamChunk[],
): void {
	if (!delta.reasoning_details || !Array.isArray(delta.reasoning_details)) return

	for (const detail of delta.reasoning_details) {
		handleSingleReasoningDetail(detail, ctx, results)
	}
}

function processReasoningDelta(delta: Record<string, unknown>, ctx: StreamContext, results: ApiStreamChunk[]): void {
	if ("reasoning" in delta && delta.reasoning && typeof delta.reasoning === "string") {
		if (!ctx.hasYieldedReasoningFromDetails) {
			results.push({ type: "reasoning", text: delta.reasoning as string })
		}
	}
}

function processToolCallDelta(delta: Record<string, unknown>, results: ApiStreamChunk[]): void {
	if (!("tool_calls" in delta) || !Array.isArray(delta.tool_calls)) return

	for (const toolCall of delta.tool_calls) {
		results.push({
			type: "tool_call_partial",
			index: toolCall.index,
			id: toolCall.id,
			name: toolCall.function?.name,
			arguments: toolCall.function?.arguments,
		})
	}
}

export function processStreamChunk(
	chunk: OpenAI.Chat.Completions.ChatCompletionChunk,
	ctx: StreamContext,
): ApiStreamChunk[] {
	const delta = chunk.choices[0]?.delta

	if (!delta) return []

	const results: ApiStreamChunk[] = []

	processReasoningDetails(delta as Parameters<typeof processReasoningDetails>[0], ctx, results)
	processReasoningDelta(delta as Record<string, unknown>, ctx, results)
	processToolCallDelta(delta as Record<string, unknown>, results)

	if (delta.content) {
		results.push({ type: "text", text: delta.content })
	}

	return results
}

export function buildUsageChunk(lastUsage: CompletionUsage | undefined):
	| {
			type: "usage"
			inputTokens: number
			outputTokens: number
			cacheReadTokens: number | undefined
			reasoningTokens: number | undefined
			totalCost: number
	  }
	| undefined {
	if (!lastUsage) return undefined

	return {
		type: "usage",
		inputTokens: lastUsage.prompt_tokens ?? 0,
		outputTokens: lastUsage.completion_tokens ?? 0,
		cacheReadTokens: lastUsage.prompt_tokens_details?.cached_tokens,
		reasoningTokens: lastUsage.completion_tokens_details?.reasoning_tokens,
		totalCost: lastUsage.cost ?? 0,
	}
}

export function consolidateStreamedReasoning(ctx: StreamContext): ReasoningDetail[] {
	if (ctx.reasoningDetailsAccumulator.size === 0) return []

	const rawDetails = Array.from(ctx.reasoningDetailsAccumulator.values())
	return consolidateReasoningDetails(
		rawDetails.map((d) => ({
			...d,
			signature: d.signature ?? undefined,
		})) as ReasoningDetail[],
	)
}
