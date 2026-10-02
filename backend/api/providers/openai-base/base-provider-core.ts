import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"

import { getModelMaxOutputTokens } from "@shared/api"
import { TagMatcher } from "@utils/text"
import { ApiStream } from "@api/transform/stream"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"

import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { DEFAULT_HEADERS } from "@api/providers/constants"
import { createBaseProvider } from "@api/providers/base-provider"
import { handleProviderError } from "@api/providers/utils/error-handler"
import { getApiRequestTimeout } from "@api/providers/utils/timeout-config"

import type { BaseOpenAiCompatibleProviderOptions, UsageMetrics, ProviderErrorResponse } from "./types"
import { processStreamChunkBody, flushMatcher, processUsageMetrics } from "./stream-utils"

export function BaseOpenAiCompatibleProvider<ModelName extends string>({
	providerName,
	baseURL,
	defaultProviderModelId,
	providerModels,
	defaultTemperature,
	...options
}: BaseOpenAiCompatibleProviderOptions<ModelName>) {
	defaultTemperature = defaultTemperature ?? 0

	if (!options.apiKey) {
		throw new Error("API key is required")
	}

	const client = new OpenAI({
		baseURL,
		apiKey: options.apiKey,
		defaultHeaders: DEFAULT_HEADERS,
		timeout: getApiRequestTimeout(),
	})

	const base = createBaseProvider()
	const handler = {
		...base,
		providerName,
		baseURL,
		defaultTemperature: defaultTemperature,
		defaultProviderModelId,
		providerModels,
		options,
		client: client,
		buildCreateStreamParams(
			model: ModelName,
			info: ModelInfo,
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
			const max_tokens =
				getModelMaxOutputTokens({
					modelId: model,
					model: info,
					settings: handler.options,
					format: "openai",
				}) ?? undefined
			const temperature =
				handler.options.modelTemperature ?? info.defaultTemperature ?? handler.defaultTemperature
			const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model,
				max_tokens,
				temperature,
				messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
				stream: true,
				stream_options: { include_usage: true },
				tools: handler.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}
			if (handler.options.enableReasoningEffort && info.supportsReasoningBinary) {
				;(
					params as {
						thinking?: {
							type: string
						}
					}
				).thinking = { type: "enabled" }
			}
			return params
		},
		createStream(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
			requestOptions?: OpenAI.RequestOptions,
		) {
			const { id: model, info } = handler.getModel(metadata?.modelId)
			const params = handler.buildCreateStreamParams(model, info, systemPrompt, messages, metadata)
			try {
				return handler.client.chat.completions.create(params, requestOptions)
			} catch (error) {
				throw handleProviderError(error, handler.providerName)
			}
		},
		throwProviderError(response: ProviderErrorResponse): void {
			throw new Error(
				`${handler.providerName} API Error (${response.base_resp!.status_code}): ${response.base_resp!.status_msg || "Unknown error"}`,
			)
		},
		checkBaseRespError(chunk: unknown): void {
			const resp = chunk as ProviderErrorResponse
			if (resp.base_resp?.status_code && resp.base_resp.status_code !== 0) {
				handler.throwProviderError(resp)
			}
		},
		*processStreamChunk(
			matcher: TagMatcher<{
				type: "reasoning" | "text"
				text: string
			}>,
			activeToolCallIds: Set<string>,
			chunk: OpenAI.Chat.Completions.ChatCompletionChunk,
		): Generator<
			| {
					type: "text"
					text: string
			  }
			| {
					type: "reasoning"
					text: string
			  }
			| import("./types").ToolCallPartial
			| {
					type: "tool_call_end"
					id: string
			  }
		> {
			handler.checkBaseRespError(chunk)
			const delta = chunk.choices?.[0]?.delta
			const finishReason = chunk.choices?.[0]?.finish_reason
			const streamChunks = processStreamChunkBody(
				delta as Record<string, unknown> | undefined,
				finishReason,
				matcher,
				activeToolCallIds,
			)
			for (const processedChunk of streamChunks) {
				yield processedChunk
			}
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const stream = await handler.createStream(systemPrompt, messages, metadata)
			const matcher = TagMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)
			let lastUsage: OpenAI.CompletionUsage | undefined
			const activeToolCallIds = new Set<string>()
			for await (const chunk of stream) {
				yield* handler.processStreamChunk(matcher, activeToolCallIds, chunk)
				if (chunk.usage) {
					lastUsage = chunk.usage
				}
			}
			if (lastUsage) {
				yield processUsageMetrics(lastUsage as UsageMetrics, handler.getModel(metadata?.modelId).info)
			}
			const finalChunks = flushMatcher(matcher)
			for (const processedChunk of finalChunks) {
				yield processedChunk
			}
		},
		async completePrompt(prompt: string): Promise<string> {
			const { id: modelId, info: modelInfo } = handler.getModel()
			const params = handler.buildCompletePromptParams(modelId, modelInfo, prompt)
			try {
				const response = await handler.client.chat.completions.create(params)
				handler.checkBaseRespError(response)
				if (!("choices" in response)) {
					return ""
				}
				return response.choices?.[0]?.message.content || ""
			} catch (error) {
				throw handleProviderError(error, handler.providerName)
			}
		},
		buildCompletePromptParams(
			modelId: ModelName,
			modelInfo: ModelInfo,
			prompt: string,
		): OpenAI.Chat.Completions.ChatCompletionCreateParams {
			const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			}
			if (handler.options.enableReasoningEffort && modelInfo.supportsReasoningBinary) {
				;(
					params as {
						thinking?: {
							type: string
						}
					}
				).thinking = { type: "enabled" }
			}
			return params
		},
		getModel(modelIdOverride?: string) {
			const id =
				(modelIdOverride || handler.options.apiModelId) &&
				(modelIdOverride || handler.options.apiModelId)! in handler.providerModels
					? ((modelIdOverride || handler.options.apiModelId) as ModelName)
					: handler.defaultProviderModelId
			return { id, info: handler.providerModels[id] }
		},
	}
	return handler
}
