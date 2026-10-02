import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"
import { OPENAI_AZURE_AI_INFERENCE_PATH } from "@jabberwock/types"

import { TagMatcher } from "@utils/text"

import type { ApiStreamChunk, ApiStreamUsageChunk } from "@api/transform/stream"

import { handleProviderError } from "@api/providers/utils/error-handler"
import { isAzureAiInference } from "./utils"

export function* processOpenAiContent(
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

export function* processNonStreamToolCalls(
	message: OpenAI.Chat.Completions.ChatCompletionMessage | undefined,
): Generator<ApiStreamChunk> {
	if (message?.tool_calls) {
		for (const toolCall of message.tool_calls) {
			if (toolCall.type === "function") {
				yield {
					type: "tool_call",
					id: toolCall.id,
					name: toolCall.function.name,
					arguments: toolCall.function.arguments,
				}
			}
		}
	}
}

export function* processToolCalls(
	delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined,
	finishReason: string | null | undefined,
	activeToolCallIds: Set<string>,
): Generator<
	| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
	| { type: "tool_call_end"; id: string }
> {
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

	// Emit tool_call_end events when finish_reason is "tool_calls"
	// This ensures tool calls are finalized even if the stream doesn't properly close
	if (finishReason === "tool_calls" && activeToolCallIds.size > 0) {
		for (const id of activeToolCallIds) {
			yield { type: "tool_call_end", id }
		}
		activeToolCallIds.clear()
	}
}

export function processUsageMetrics(
	usage: OpenAI.CompletionUsage | undefined,
	_modelInfo?: ModelInfo,
): ApiStreamUsageChunk {
	const usageExtended = usage as OpenAI.CompletionUsage & {
		cache_creation_input_tokens?: number
		cache_read_input_tokens?: number
	}
	return {
		type: "usage",
		inputTokens: (usage?.prompt_tokens ?? 0) as number,
		outputTokens: (usage?.completion_tokens ?? 0) as number,
		cacheWriteTokens: usageExtended?.cache_creation_input_tokens as number | undefined,
		cacheReadTokens: usageExtended?.cache_read_input_tokens as number | undefined,
	}
}

export function applyPromptCacheControl(convertedMessages: OpenAI.Chat.ChatCompletionMessageParam[]): void {
	// Note: the following logic is copied from openrouter:
	// Add cache_control to the last two user messages
	// (note: this works because we only ever add one user message at a time, but if we added multiple we'd need to mark the user message before the last assistant message)
	const lastTwoUserMessages = convertedMessages.filter((msg) => msg.role === "user").slice(-2)

	lastTwoUserMessages.forEach((msg) => {
		if (typeof msg.content === "string") {
			msg.content = [{ type: "text", text: msg.content }]
		}

		if (Array.isArray(msg.content)) {
			// NOTE: this is fine since env details will always be added at the end. but if it weren't there, and the user added a image_url type message, it would pop a text part before it and then move it after to the end.
			let lastTextPart = msg.content.filter((part) => part.type === "text").pop()

			if (!lastTextPart) {
				lastTextPart = { type: "text", text: "..." }
				msg.content.push(lastTextPart)
			}

			;(
				lastTextPart as OpenAI.Chat.ChatCompletionContentPartText & {
					cache_control?: { type: "ephemeral" }
				}
			)["cache_control"] = { type: "ephemeral" }
		}
	})
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
