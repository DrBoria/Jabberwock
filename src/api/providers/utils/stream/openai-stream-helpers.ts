import OpenAI from "openai"
import type { ModelInfo } from "@jabberwock/types"
import { OPENAI_AZURE_AI_INFERENCE_PATH } from "@jabberwock/types"
import { TagMatcher } from "@utils/text/tag-matcher"
import type { ApiStreamChunk, ApiStreamUsageChunk } from "@api/transform/stream"
import { extractOpenAiCacheMetrics, type RawUsage } from "./openai-stream-cache"
import { handleProviderError } from "@api/providers/utils/error-handler"
import { isAzureAiInference } from "@api/providers/openai/utils"

export type ToolCallPartial = {
	type: "tool_call_partial"
	index: number
	id?: string
	name?: string
	arguments?: string
}

export type ToolCallEnd = {
	type: "tool_call_end"
	id: string
}

export function* processToolCallsFromDelta(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined,
	finishReason: string | null | undefined,
	activeToolCallIds: Set<string>,
): Generator<ToolCallPartial | ToolCallEnd> {
	if (delta?.tool_calls) {
		for (const toolCall of delta.tool_calls) {
			if (toolCall.id) {
				activeToolCallIds.add(toolCall.id)
			}
			yield {
				type: "tool_call_partial",
				index: toolCall.index,
				id: toolCall.id,
				name: toolCall.function?.name,
				arguments: toolCall.function?.arguments,
			}
		}
	}
	if (finishReason === "tool_calls" && activeToolCallIds.size > 0) {
		for (const id of activeToolCallIds) {
			yield { type: "tool_call_end", id }
		}
		activeToolCallIds.clear()
	}
}

function parseGenericToolCalls(toolCalls: unknown, activeToolCallIds: Set<string>): ToolCallPartial[] {
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

function emitToolCallEnds(activeToolCallIds: Set<string>, finishReason: string | null | undefined): ToolCallEnd[] {
	if (finishReason === "tool_calls" && activeToolCallIds.size > 0) {
		const result: ToolCallEnd[] = []
		for (const id of activeToolCallIds) {
			result.push({ type: "tool_call_end", id })
		}
		activeToolCallIds.clear()
		return result
	}
	return []
}

export function processToolCallsFromGenericDelta(
	delta: Record<string, unknown>,
	finishReason: string | null | undefined,
	activeToolCallIds: Set<string>,
): (ToolCallPartial | ToolCallEnd)[] {
	const result: (ToolCallPartial | ToolCallEnd)[] = []
	const toolCalls = delta.tool_calls
	if (toolCalls) {
		result.push(...parseGenericToolCalls(toolCalls, activeToolCallIds))
	}
	result.push(...emitToolCallEnds(activeToolCallIds, finishReason))
	return result
}

export function processUsageFromCompletion(usage: RawUsage | undefined, _modelInfo?: ModelInfo): ApiStreamUsageChunk {
	const inputTokens = usage?.prompt_tokens ?? 0
	const outputTokens = usage?.completion_tokens ?? 0
	const { cacheWriteTokens, cacheReadTokens } = extractOpenAiCacheMetrics(usage)
	return {
		type: "usage",
		inputTokens,
		outputTokens,
		cacheWriteTokens: cacheWriteTokens || undefined,
		cacheReadTokens: cacheReadTokens || undefined,
	}
}

export async function createStreamWithErrorHandling(
	client: OpenAI,
	requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
	modelUrl: string,
	providerName: string,
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
	try {
		return await client.chat.completions.create(
			requestOptions,
			isAzureAiInference(modelUrl) ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
		)
	} catch (error) {
		throw handleProviderError(error, providerName)
	}
}

export async function createCompletionWithErrorHandling(
	client: OpenAI,
	requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
	modelUrl: string,
	providerName: string,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
	try {
		return await client.chat.completions.create(
			requestOptions,
			isAzureAiInference(modelUrl) ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
		)
	} catch (error) {
		throw handleProviderError(error, providerName)
	}
}

export function* processOpenAiDeltaContent(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined,
	matcher: TagMatcher<{ readonly type: "text" | "reasoning"; readonly text: string }>,
): Generator<ApiStreamChunk> {
	if (!delta) {
		return
	}
	if (delta.content) {
		for (const chunk of matcher.update(delta.content)) {
			yield chunk
		}
	}
	if ("reasoning_content" in delta && delta.reasoning_content) {
		yield {
			type: "reasoning",
			text: (delta.reasoning_content as string | undefined) || "",
		}
	}
}

export function emitReasoningFromGenericDelta(delta: Record<string, unknown>): Array<{
	type: "reasoning"
	text: string
}> {
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
