import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"
import type { ApiHandlerOptions } from "@shared/api"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import type { ApiStream } from "@api/transform/stream"

import {
	processToolCalls,
	createStreamWithErrorHandling,
	createCompletionWithErrorHandling,
	processNonStreamToolCalls,
	processUsageMetrics,
} from "./main"
import { addMaxTokensIfNeeded, isGrokXAI, isAzureAiInference } from "./utils"

export function OpenAiO3Handler(
	client: OpenAI,
	options: ApiHandlerOptions,
	providerName: string,
	convertToolsForOpenAI: (
		tools: OpenAI.Chat.ChatCompletionTool[] | undefined,
	) => OpenAI.Chat.ChatCompletionTool[] | undefined,
) {
	const handler = {
		client,
		options,
		providerName,
		convertToolsForOpenAI,
		isO3FamilyModel(modelId: string): boolean {
			return modelId.includes("o1") || modelId.includes("o3") || modelId.includes("o4")
		},
		async *handleO3FamilyMessage(
			modelId: string,
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const modelInfo = handler.getModelInfo()
			const methodIsAzureAiInference = isAzureAiInference(handler.options.openAiBaseUrl)
			if (handler.options.openAiStreamingEnabled ?? true) {
				yield* handler.handleO3Streaming(
					modelId,
					systemPrompt,
					messages,
					metadata,
					modelInfo,
					methodIsAzureAiInference,
				)
			} else {
				yield* handler.handleO3NonStreaming(
					modelId,
					systemPrompt,
					messages,
					metadata,
					modelInfo,
					methodIsAzureAiInference,
				)
			}
		},
		getModelInfo(): ModelInfo {
			return (
				handler.options.openAiCustomModelInfo ?? {
					maxTokens: -1,
					contextWindow: 128000,
					supportsImages: true,
					supportsPromptCache: false,
					inputPrice: 0,
					outputPrice: 0,
				}
			)
		},
		async *handleO3Streaming(
			modelId: string,
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata: ApiHandlerCreateMessageMetadata | undefined,
			modelInfo: ModelInfo,
			isAzureAiInferenceFlag: boolean,
		): ApiStream {
			const grokXAI = isGrokXAI(handler.options.openAiBaseUrl)
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: modelId,
				messages: [
					{
						role: "developer",
						content: `Formatting re-enabled\n${systemPrompt}`,
					},
					...convertToOpenAiMessages(messages),
				],
				stream: true,
				...(grokXAI ? {} : { stream_options: { include_usage: true } }),
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
				tools: handler.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}
			addMaxTokensIfNeeded(handler.options, requestOptions, modelInfo)
			const stream = await createStreamWithErrorHandling(
				handler.client,
				requestOptions,
				isAzureAiInferenceFlag ? (handler.options.openAiBaseUrl ?? "") : "",
				handler.providerName,
			)
			yield* handler.handleStreamResponse(stream)
		},
		buildO3NonStreamRequestOptions(
			modelId: string,
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata: ApiHandlerCreateMessageMetadata | undefined,
			modelInfo: ModelInfo,
		): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
			const options: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [
					{
						role: "developer",
						content: `Formatting re-enabled\n${systemPrompt}`,
					},
					...convertToOpenAiMessages(messages),
				],
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
				tools: handler.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}
			addMaxTokensIfNeeded(handler.options, options, modelInfo)
			return options
		},
		async *handleO3NonStreaming(
			modelId: string,
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata: ApiHandlerCreateMessageMetadata | undefined,
			modelInfo: ModelInfo,
			isAzureAiInferenceFlag: boolean,
		): ApiStream {
			const requestOptions = handler.buildO3NonStreamRequestOptions(
				modelId,
				systemPrompt,
				messages,
				metadata,
				modelInfo,
			)
			const response = await createCompletionWithErrorHandling(
				handler.client,
				requestOptions,
				isAzureAiInferenceFlag ? (handler.options.openAiBaseUrl ?? "") : "",
				handler.providerName,
			)
			const message = response.choices?.[0]?.message
			yield* processNonStreamToolCalls(message)
			yield {
				type: "text",
				text: message?.content || "",
			}
			yield processUsageMetrics(response.usage)
		},
		async *handleStreamResponse(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): ApiStream {
			const activeToolCallIds = new Set<string>()
			for await (const chunk of stream) {
				const firstChoice = chunk.choices?.[0]
				const delta = firstChoice?.delta
				const finishReason = firstChoice?.finish_reason
				if (delta) {
					if (delta.content) {
						yield {
							type: "text",
							text: delta.content,
						}
					}
					yield* processToolCalls(delta, finishReason, activeToolCallIds)
				}
				if (chunk.usage) {
					yield {
						type: "usage",
						inputTokens: chunk.usage.prompt_tokens || 0,
						outputTokens: chunk.usage.completion_tokens || 0,
					}
				}
			}
		},
	}
	return handler
}
