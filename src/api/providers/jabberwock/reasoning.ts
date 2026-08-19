import OpenAI from "openai"

import type {
	ReasoningDetailInput,
	ReasoningDetailValue,
	StreamYield,
	ReasoningYieldsResult,
	StreamChunkResult,
	RooUsage,
} from "./types"

export function processChunk(
	chunk: OpenAI.Chat.ChatCompletionChunk,
	accumulator: Map<string, ReasoningDetailValue>,
	hasYieldedReasoning: boolean,
): StreamChunkResult {
	const yields: StreamYield[] = []
	let hasYielded = hasYieldedReasoning

	const delta = chunk.choices[0]?.delta

	if (!delta) {
		return {
			yields,
			hasYieldedReasoning: hasYielded,
			lastUsage: chunk.usage as RooUsage | undefined,
		}
	}

	const deltaWithReasoning = delta as typeof delta & {
		reasoning_details?: ReasoningDetailInput[]
	}

	if (deltaWithReasoning.reasoning_details && Array.isArray(deltaWithReasoning.reasoning_details)) {
		const detailsResult = processReasoningDetailsYields(deltaWithReasoning.reasoning_details, accumulator)
		yields.push(...detailsResult.yields)
		if (detailsResult.hasYieldedReasoning) {
			hasYielded = true
		}
	}

	const topLevelResult = processTopLevelReasoningYields(delta, hasYielded)
	yields.push(...topLevelResult.yields)
	hasYielded = topLevelResult.hasYieldedReasoning

	appendToolCallYields(delta, yields)

	if (delta.content) {
		yields.push({ type: "text", text: delta.content })
	}

	return {
		yields,
		hasYieldedReasoning: hasYielded,
		lastUsage: chunk.usage as RooUsage | undefined,
	}
}

function processReasoningDetailsYields(
	details: ReasoningDetailInput[],
	accumulator: Map<string, ReasoningDetailValue>,
): ReasoningYieldsResult {
	const yields: StreamYield[] = []
	let hasYielded = false

	for (const detail of details) {
		accumulateReasoningDetail(detail, accumulator)

		const reasoningText = getReasoningDisplayText(detail)

		if (reasoningText) {
			hasYielded = true
			yields.push({ type: "reasoning", text: reasoningText })
		}
	}

	return { yields, hasYieldedReasoning: hasYielded }
}

function getReasoningDisplayText(detail: ReasoningDetailInput): string | undefined {
	if (detail.type === "reasoning.text" && typeof detail.text === "string") {
		return detail.text
	}

	if (detail.type === "reasoning.summary" && typeof detail.summary === "string") {
		return detail.summary
	}

	return undefined
}

function accumulateReasoningDetail(detail: ReasoningDetailInput, accumulator: Map<string, ReasoningDetailValue>): void {
	const index = detail.index ?? 0
	const key = detail.id ?? `${detail.type}-${index}`
	const existing = accumulator.get(key)

	if (existing) {
		mergeAccumulatedDetail(existing, detail)
		return
	}

	accumulator.set(key, {
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

function mergeAccumulatedDetail(existing: ReasoningDetailValue, detail: ReasoningDetailInput): void {
	if (detail.text !== undefined) {
		existing.text = (existing.text ?? "") + detail.text
	}

	if (detail.summary !== undefined) {
		existing.summary = (existing.summary ?? "") + detail.summary
	}

	if (detail.data !== undefined) {
		existing.data = (existing.data ?? "") + detail.data
	}

	if (detail.id !== undefined) {
		existing.id = detail.id
	}

	if (detail.format !== undefined) {
		existing.format = detail.format
	}

	if (detail.signature !== undefined) {
		existing.signature = detail.signature
	}
}

function processTopLevelReasoningYields(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta,
	hasYieldedFromDetails: boolean,
): ReasoningYieldsResult {
	const yields: StreamYield[] = []

	if (hasYieldedFromDetails) {
		return { yields, hasYieldedReasoning: true }
	}

	if ("reasoning" in delta) {
		const reasoningText = delta.reasoning
		if (typeof reasoningText === "string" && reasoningText) {
			yields.push({ type: "reasoning", text: reasoningText })
			return { yields, hasYieldedReasoning: true }
		}
	}

	if ("reasoning_content" in delta) {
		const reasoningContent = delta.reasoning_content
		if (typeof reasoningContent === "string") {
			yields.push({ type: "reasoning", text: reasoningContent })
			return { yields, hasYieldedReasoning: true }
		}
	}

	return { yields, hasYieldedReasoning: false }
}

function appendToolCallYields(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta,
	yields: StreamYield[],
): void {
	if (!("tool_calls" in delta)) {
		return
	}

	if (!Array.isArray(delta.tool_calls)) {
		return
	}

	for (const toolCall of delta.tool_calls) {
		yields.push({
			type: "tool_call_partial",
			index: toolCall.index,
			id: toolCall.id,
			name: toolCall.function?.name,
			arguments: toolCall.function?.arguments,
		})
	}
}
