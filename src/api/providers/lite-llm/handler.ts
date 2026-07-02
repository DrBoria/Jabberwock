import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk" // Keep for type usage only

import { type ModelInfo, litellmDefaultModelId, litellmDefaultModelInfo } from "@jabberwock/types"

import { ApiHandlerOptions } from "@shared/api"

import { ApiStream } from "@api/transform/stream"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { sanitizeOpenAiCallId } from "@utils/mcp"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import { RouterProvider } from "@api/providers/router-provider"

import {
	isGeminiModel,
	injectThoughtSignatureForGemini,
	applyCacheControlToMessage,
	processLiteLLMChunk,
	buildUsageChunk,
} from "./helpers"
import type { LiteLLMUsage } from "./types"

/**
 * LiteLLM provider handler
 *
 * This handler uses the LiteLLM API to proxy requests to various LLM providers.
 * It follows the OpenAI API format for compatibility.
 */
export class LiteLLMHandler extends RouterProvider implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			options,
			name: "litellm",
			baseURL: `${options.litellmBaseUrl || "http://localhost:4000"}`,
			apiKey: options.litellmApiKey || "dummy-key",
			modelId: options.litellmModelId,
			defaultModelId: litellmDefaultModelId,
			defaultModelInfo: litellmDefaultModelInfo,
		})
	}

	private buildCacheEnabledMessages(
		systemPrompt: string,
		openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
		info: ModelInfo,
	): {
		systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam
		enhancedMessages: OpenAI.Chat.ChatCompletionMessageParam[]
	} {
		if (!this.options.litellmUsePromptCache || !info.supportsPromptCache) {
			return {
				systemMessage: { role: "system", content: systemPrompt },
				enhancedMessages: openAiMessages,
			}
		}

		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: [
				{
					type: "text",
					text: systemPrompt,
					cache_control: { type: "ephemeral" },
				} as OpenAI.Chat.ChatCompletionContentPartText & { cache_control: { type: "ephemeral" } },
			] as OpenAI.Chat.ChatCompletionContentPartText[],
		}

		const userMsgIndices = openAiMessages.reduce<number[]>(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[],
		)
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastUserMsgIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

		const enhancedMessages = openAiMessages.map((message, index) => {
			if ((index === lastUserMsgIndex || index === secondLastUserMsgIndex) && message.role === "user") {
				return applyCacheControlToMessage(message)
			}
			return message
		})

		return { systemMessage, enhancedMessages }
	}

	private buildLiteLLMRequestOptions(
		modelId: string,
		systemMessage: OpenAI.Chat.ChatCompletionMessageParam,
		processedMessages: OpenAI.Chat.ChatCompletionMessageParam[],
		metadata: ApiHandlerCreateMessageMetadata | undefined,
		info: ModelInfo,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
		const isGPT5Model = /\bgpt-?5(?!\d)/i.test(modelId)
		const maxTokens: number | undefined = info.maxTokens ?? undefined

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			messages: [systemMessage, ...processedMessages],
			stream: true,
			stream_options: { include_usage: true },
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
		}

		if (isGPT5Model && maxTokens) {
			requestOptions.max_completion_tokens = maxTokens
		} else if (maxTokens) {
			requestOptions.max_tokens = maxTokens
		}

		if (this.supportsTemperature(modelId)) {
			requestOptions.temperature = this.options.modelTemperature ?? 0
		}

		return requestOptions
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info } = await this.fetchModel()

		const openAiMessages = convertToOpenAiMessages(messages, {
			normalizeToolCallId: sanitizeOpenAiCallId,
		})

		const { systemMessage, enhancedMessages } = this.buildCacheEnabledMessages(systemPrompt, openAiMessages, info)

		const isGemini = isGeminiModel(modelId)
		const processedMessages = isGemini ? injectThoughtSignatureForGemini(enhancedMessages) : enhancedMessages

		const requestOptions = this.buildLiteLLMRequestOptions(
			modelId,
			systemMessage,
			processedMessages,
			metadata,
			info,
		)

		try {
			const { data: completion } = await this.client.chat.completions.create(requestOptions).withResponse()

			let lastUsage

			for await (const chunk of completion) {
				const delta = chunk.choices[0]?.delta
				const usage = chunk.usage as LiteLLMUsage

				yield* processLiteLLMChunk(delta)

				if (usage) {
					lastUsage = usage
				}
			}

			if (lastUsage) {
				yield buildUsageChunk(lastUsage, info)
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`LiteLLM streaming error: ${error.message}`)
			}
			throw error
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info } = await this.fetchModel()

		// Check if this is a GPT-5 model that requires max_completion_tokens instead of max_tokens
		const isGPT5Model = /\bgpt-?5(?!\d)/i.test(modelId)

		try {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			}

			if (this.supportsTemperature(modelId)) {
				requestOptions.temperature = this.options.modelTemperature ?? 0
			}

			// GPT-5 models require max_completion_tokens instead of the deprecated max_tokens parameter
			if (isGPT5Model && info.maxTokens) {
				requestOptions.max_completion_tokens = info.maxTokens
			} else if (info.maxTokens) {
				requestOptions.max_tokens = info.maxTokens
			}

			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`LiteLLM completion error: ${error.message}`)
			}
			throw error
		}
	}
}
