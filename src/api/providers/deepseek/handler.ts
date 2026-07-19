import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	deepSeekModels,
	deepSeekDefaultModelId,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	OPENAI_AZURE_AI_INFERENCE_PATH,
} from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import { ApiStream, ApiStreamUsageChunk } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"
import { convertToR1Format } from "@api/transform/r1/format"

import { OpenAiHandler } from "@api/providers/openai"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { handleProviderError } from "@api/providers/utils/error-handler"
import { addMaxTokensIfNeeded, isAzureAiInference } from "@api/providers/openai/utils"

// Custom interface for DeepSeek params to support thinking mode
type DeepSeekChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
	thinking?: { type: "enabled" | "disabled" }
}

export class DeepSeekHandler extends OpenAiHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.deepSeekApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
			openAiBaseUrl: options.deepSeekBaseUrl || "https://api.deepseek.com",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? deepSeekDefaultModelId
		const info = deepSeekModels[id as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: DEEP_SEEK_DEFAULT_TEMPERATURE,
		})
		return { id, info, ...params }
	}

	private buildDeepSeekRequestOptions(
		modelId: string,
		isThinkingModel: boolean,
		metadata: ApiHandlerCreateMessageMetadata | undefined,
		convertedMessages: OpenAI.Chat.ChatCompletionMessageParam[],
	): DeepSeekChatCompletionParams {
		return {
			model: modelId,
			temperature: this.options.modelTemperature ?? DEEP_SEEK_DEFAULT_TEMPERATURE,
			messages: convertedMessages,
			stream: true as const,
			stream_options: { include_usage: true },
			...(isThinkingModel && { thinking: { type: "enabled" } }),
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}
	}

	private async executeDeepSeekRequest(requestOptions: DeepSeekChatCompletionParams, isAzureAiInference: boolean) {
		try {
			return await this.client.chat.completions.create(
				requestOptions,
				isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
			)
		} catch (error) {
			throw handleProviderError(error, "DeepSeek")
		}
	}

	private getDeltaFromChunk(chunk: OpenAI.Chat.Completions.ChatCompletionChunk): Record<string, unknown> {
		return (chunk.choices?.[0]?.delta as Record<string, unknown>) ?? {}
	}

	private *processChunkContent(
		delta: Record<string, unknown>,
	): Generator<
		| { type: "text"; text: string }
		| { type: "reasoning"; text: string }
		| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
	> {
		if (delta.content) {
			yield { type: "text", text: delta.content as string }
		}

		if ("reasoning_content" in delta && delta.reasoning_content) {
			yield { type: "reasoning", text: delta.reasoning_content as string }
		}

		if (delta.tool_calls) {
			const toolCalls = delta.tool_calls as Array<{
				index: number
				id?: string
				function?: { name?: string; arguments?: string }
			}>
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
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const modelId = this.options.apiModelId ?? deepSeekDefaultModelId
		const { info: modelInfo } = this.getModel()

		const isThinkingModel = modelId.includes("deepseek-reasoner")

		const convertedMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages], {
			mergeToolResultText: true,
		})

		const requestOptions = this.buildDeepSeekRequestOptions(modelId, isThinkingModel, metadata, convertedMessages)

		addMaxTokensIfNeeded(this.options, requestOptions, modelInfo)

		const stream = await this.executeDeepSeekRequest(
			requestOptions,
			isAzureAiInference(this.options.deepSeekBaseUrl),
		)

		let lastUsage

		for await (const chunk of stream) {
			const delta = this.getDeltaFromChunk(chunk)

			yield* this.processChunkContent(delta)

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, modelInfo)
		}
	}

	// Override to handle DeepSeek's usage metrics, including caching.
	protected processUsageMetrics(usage: OpenAI.CompletionUsage, _modelInfo?: unknown): ApiStreamUsageChunk {
		const usageTyped = usage as OpenAI.CompletionUsage & { prompt_tokens_details?: Record<string, unknown> }
		const details = usageTyped?.prompt_tokens_details
		return {
			type: "usage",
			inputTokens: (usage?.prompt_tokens as number) || 0,
			outputTokens: (usage?.completion_tokens as number) || 0,
			cacheWriteTokens: (details?.cache_miss_tokens as number) || undefined,
			cacheReadTokens: (details?.cached_tokens as number) || undefined,
		}
	}
}
