import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"
import { calculateApiCostOpenAI } from "@shared/api/cost"
import { ApiStreamUsageChunk } from "@api/transform/stream"

import { UnboundUsage } from "./types"

export function processUsageMetrics(usage: OpenAI.CompletionUsage, modelInfo?: ModelInfo): ApiStreamUsageChunk {
	const unboundUsage = usage as UnboundUsage
	const inputTokens = unboundUsage?.prompt_tokens || 0
	const outputTokens = unboundUsage?.completion_tokens || 0
	const cacheWriteTokens = unboundUsage?.cache_creation_input_tokens || 0
	const cacheReadTokens = unboundUsage?.cache_read_input_tokens || 0
	const { totalCost } = modelInfo
		? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
		: { totalCost: 0 }

	return {
		type: "usage",
		inputTokens: inputTokens,
		outputTokens: outputTokens,
		cacheWriteTokens: cacheWriteTokens,
		cacheReadTokens: cacheReadTokens,
		totalCost: totalCost,
	}
}

export function mapReasoningEffort(
	effort: string | undefined,
): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming["reasoning_effort"] {
	if (effort === "low" || effort === "medium" || effort === "high") {
		return effort
	}
	return undefined
}

export function getReasoningText(delta: unknown): string | undefined {
	const record = delta as Record<string, unknown> | undefined
	if (record && "reasoning_content" in record && record.reasoning_content) {
		return (record.reasoning_content as string | undefined) || ""
	}
	return undefined
}

export function* processUnboundToolCalls(
	toolCalls: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[],
): Generator<{ type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }> {
	for (const toolCall of toolCalls) {
		yield {
			type: "tool_call_partial",
			index: toolCall.index,
			id: toolCall.id,
			name: toolCall.function?.name,
			arguments: toolCall.function?.arguments,
		}
	}
}

export function* processUnboundChunk(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined,
	chunk: OpenAI.Chat.ChatCompletionChunk,
): Generator<
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string },
	OpenAI.CompletionUsage | undefined,
	OpenAI.CompletionUsage | undefined
> {
	if (delta?.content) {
		yield { type: "text", text: delta.content }
	}

	const reasoning = getReasoningText(delta)
	if (reasoning) {
		yield { type: "reasoning", text: reasoning }
	}

	if (delta?.tool_calls) {
		yield* processUnboundToolCalls(delta.tool_calls)
	}

	return chunk.usage ?? undefined
}
