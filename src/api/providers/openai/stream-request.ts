import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"
import { DEEP_SEEK_DEFAULT_TEMPERATURE } from "@jabberwock/types"
import type { ApiHandlerOptions } from "@shared/api"
import type { OpenAiReasoningParams } from "@api/transform/content/reasoning"
import { TagMatcher } from "@utils/text"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { convertToR1Format } from "@api/transform/r1/format"
import type { ApiStream } from "@api/transform/stream"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"

import {
	processOpenAiContent,
	processToolCalls,
	processUsageMetrics,
	applyPromptCacheControl,
	createStreamWithErrorHandling,
} from "./stream"
import { addMaxTokensIfNeeded, isGrokXAI, isDeepseekReasoner } from "./utils"

export class OpenAiStreamRequestHandler {
	constructor(
		private readonly client: OpenAI,
		private readonly options: ApiHandlerOptions,
		private readonly providerName: string,
		private readonly convertToolsForOpenAI: (
			tools: OpenAI.Chat.ChatCompletionTool[] | undefined,
		) => OpenAI.Chat.ChatCompletionTool[] | undefined,
	) {}

	async *handleStreamingRequest(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata: ApiHandlerCreateMessageMetadata | undefined,
		modelInfo: ModelInfo,
		reasoning: OpenAiReasoningParams | undefined,
		modelId: string,
		modelUrl: string,
	): ApiStream {
		const deepseekReasoner = isDeepseekReasoner(modelId, this.options.openAiR1FormatEnabled ?? false)
		const convertedMessages = this.buildConvertedMessages(systemPrompt, messages, modelInfo, deepseekReasoner)
		const grokXAI = isGrokXAI(modelUrl)
		const temperature = this.options.modelTemperature ?? (deepseekReasoner ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0)

		const requestOptions = this.buildStreamRequestOptions(
			modelId,
			convertedMessages,
			metadata,
			modelInfo,
			grokXAI,
			reasoning,
			temperature,
		)

		const stream = await createStreamWithErrorHandling(this.client, requestOptions, modelUrl, this.providerName)

		yield* this.processStreamWithTagMatcher(stream, modelInfo)
	}

	private async *processStreamWithTagMatcher(
		stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
		modelInfo: ModelInfo,
	): ApiStream {
		const matcher = new TagMatcher(
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
			const firstChoice = chunk.choices?.[0]
			const delta = firstChoice?.delta
			const finishReason = firstChoice?.finish_reason

			yield* processOpenAiContent(delta, matcher)

			yield* processToolCalls(delta, finishReason, activeToolCallIds)

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		for (const chunk of matcher.final()) {
			yield chunk
		}

		if (lastUsage) {
			yield processUsageMetrics(lastUsage, modelInfo)
		}
	}

	private buildStreamRequestOptions(
		modelId: string,
		convertedMessages: OpenAI.Chat.ChatCompletionMessageParam[],
		metadata: ApiHandlerCreateMessageMetadata | undefined,
		modelInfo: ModelInfo,
		isGrokXAI: boolean,
		reasoning: OpenAiReasoningParams | undefined,
		temperature: number | undefined,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
		const options: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature,
			messages: convertedMessages,
			stream: true as const,
			...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
			...(reasoning && reasoning),
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}

		addMaxTokensIfNeeded(this.options, options, modelInfo)
		return options
	}

	private buildConvertedMessages(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		modelInfo: ModelInfo,
		deepseekReasoner: boolean,
	): OpenAI.Chat.ChatCompletionMessageParam[] {
		if (deepseekReasoner) {
			return convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		}

		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = modelInfo.supportsPromptCache
			? {
					role: "system",
					content: [
						{
							type: "text",
							text: systemPrompt,
							cache_control: { type: "ephemeral" } as const,
						} as OpenAI.Chat.ChatCompletionContentPartText & { cache_control: { type: "ephemeral" } },
					],
				}
			: { role: "system", content: systemPrompt }

		const convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

		if (modelInfo.supportsPromptCache) {
			applyPromptCacheControl(convertedMessages)
		}

		return convertedMessages
	}
}
