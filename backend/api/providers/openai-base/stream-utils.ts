import { TagMatcher } from "@utils/text"
import { ApiStreamUsageChunk } from "@api/transform/stream"
import { calculateApiCostOpenAI } from "@shared/api/cost"
import type { ModelInfo } from "@jabberwock/types"
import type { UsageMetrics, ToolCallPartial } from "./types"

export function processChunkDeltaContent(
	matcher: TagMatcher<{ type: "reasoning" | "text"; text: string }>,
	content: string,
): Array<{ type: "reasoning" | "text"; text: string }> {
	const chunks = matcher.update(content) as Array<{ type: "reasoning" | "text"; text: string }>
	const result: Array<{ type: "reasoning" | "text"; text: string }> = []
	for (const processedChunk of chunks) {
		result.push(processedChunk)
	}
	return result
}

export function emitReasoningContent(delta: Record<string, unknown>): Array<{ type: "reasoning"; text: string }> {
	for (const key of ["reasoning_content", "reasoning"] as const) {
		if (key in delta) {
			const value = delta[key]
			const reasoning = typeof value === "string" ? value : ""
			if (reasoning.trim()) {
				return [{ type: "reasoning", text: reasoning }]
			}
			return []
		}
	}
	return []
}

export function emitToolCallChunks(delta: Record<string, unknown>, activeToolCallIds: Set<string>): ToolCallPartial[] {
	const toolCalls = delta.tool_calls
	if (!toolCalls) {
		return []
	}

	const result: ToolCallPartial[] = []
	for (const toolCall of toolCalls as Array<{
		index: number
		id?: string | null
		function?: { name?: string; arguments?: string }
	}>) {
		if (toolCall.id) {
			activeToolCallIds.add(toolCall.id)
		}
		result.push({
			type: "tool_call_partial",
			index: toolCall.index,
			id: toolCall.id ?? undefined,
			name: toolCall.function?.name ?? undefined,
			arguments: toolCall.function?.arguments ?? undefined,
		})
	}
	return result
}

export function emitToolCallEnd(
	finishReason: string | null | undefined,
	activeToolCallIds: Set<string>,
): Array<{ type: "tool_call_end"; id: string }> {
	if (finishReason === "tool_calls" && activeToolCallIds.size > 0) {
		const result: Array<{ type: "tool_call_end"; id: string }> = []
		for (const id of activeToolCallIds) {
			result.push({ type: "tool_call_end", id })
		}
		activeToolCallIds.clear()
		return result
	}
	return []
}

export function processStreamChunkBody(
	delta: Record<string, unknown> | undefined,
	finishReason: string | null | undefined,
	matcher: TagMatcher<{ type: "reasoning" | "text"; text: string }>,
	activeToolCallIds: Set<string>,
): Array<
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| ToolCallPartial
	| { type: "tool_call_end"; id: string }
> {
	const result: Array<
		| { type: "text"; text: string }
		| { type: "reasoning"; text: string }
		| ToolCallPartial
		| { type: "tool_call_end"; id: string }
	> = []

	if (delta?.content) {
		result.push(...processChunkDeltaContent(matcher, delta.content as string))
	}

	if (delta) {
		result.push(...emitReasoningContent(delta))
		result.push(...emitToolCallChunks(delta, activeToolCallIds))
	}

	result.push(...emitToolCallEnd(finishReason, activeToolCallIds))

	return result
}

export function flushMatcher(
	matcher: TagMatcher<{ type: "reasoning" | "text"; text: string }>,
): Array<{ type: "reasoning" | "text"; text: string }> {
	const chunks = matcher.final() as Array<{ type: "reasoning" | "text"; text: string }>
	const result: Array<{ type: "reasoning" | "text"; text: string }> = []
	for (const processedChunk of chunks) {
		result.push(processedChunk)
	}
	return result
}

export function extractCacheTokens(usage: UsageMetrics) {
	const cacheWriteTokens = usage?.prompt_tokens_details?.cache_write_tokens || 0
	const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0
	return { cacheWriteTokens, cacheReadTokens }
}

export function processUsageMetrics(usage: UsageMetrics, modelInfo?: ModelInfo): ApiStreamUsageChunk {
	const inputTokens = usage?.prompt_tokens || 0
	const outputTokens = usage?.completion_tokens || 0
	const cacheTokens = extractCacheTokens(usage)

	const { totalCost } = modelInfo
		? calculateApiCostOpenAI(
				modelInfo,
				inputTokens,
				outputTokens,
				cacheTokens.cacheWriteTokens,
				cacheTokens.cacheReadTokens,
			)
		: { totalCost: 0 }

	return {
		type: "usage",
		inputTokens,
		outputTokens,
		cacheWriteTokens: cacheTokens.cacheWriteTokens || undefined,
		cacheReadTokens: cacheTokens.cacheReadTokens || undefined,
		totalCost,
	}
}
