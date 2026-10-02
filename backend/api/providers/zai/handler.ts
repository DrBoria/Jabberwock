import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	internationalZAiModels,
	mainlandZAiModels,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	type ModelInfo,
	ZAI_DEFAULT_TEMPERATURE,
	zaiApiLineConfigs,
} from "@jabberwock/types"

import { type ApiHandlerOptions, getModelMaxOutputTokens, shouldUseReasoningEffort } from "@shared/api"
import { convertToZAiFormat } from "@api/transform/zai"

import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { BaseOpenAiCompatibleProvider } from "@api/providers/openai-base/index"

// Custom interface for Z.ai params to support thinking mode
type ZAiChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
	thinking?: { type: "enabled" | "disabled" }
}

export function ZAiHandler(options: ApiHandlerOptions) {
	const isChina = zaiApiLineConfigs[options.zaiApiLine ?? "international_coding"].isChina
	const models = (isChina ? mainlandZAiModels : internationalZAiModels) as Record<string, ModelInfo>
	const defaultModelId = (isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId) as string

	const base = BaseOpenAiCompatibleProvider({
		...options,
		providerName: "Z.ai",
		baseURL: zaiApiLineConfigs[options.zaiApiLine ?? "international_coding"].baseUrl,
		apiKey: options.zaiApiKey ?? "not-provided",
		defaultProviderModelId: defaultModelId,
		providerModels: models,
		defaultTemperature: ZAI_DEFAULT_TEMPERATURE,
	})
	const handler = {
		...base,
		createStream(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
			requestOptions?: OpenAI.RequestOptions,
		) {
			const { info } = handler.getModel()
			// Check if this is a model with thinking support (e.g. GLM-4.7, GLM-5)
			const isThinkingModel = Array.isArray(info.supportsReasoningEffort)
			if (isThinkingModel) {
				// For GLM-4.7, thinking is ON by default in the API.
				// We need to explicitly disable it when reasoning is off.
				const useReasoning = shouldUseReasoningEffort({ model: info, settings: handler.options })
				// Create the stream with our custom thinking parameter
				return handler.createStreamWithThinking(systemPrompt, messages, metadata, useReasoning)
			}
			// For non-thinking models, use the default behavior
			return base.createStream(systemPrompt, messages, metadata, requestOptions)
		},
		createStreamWithThinking(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
			useReasoning?: boolean,
		) {
			const { id: model, info } = handler.getModel()
			const max_tokens =
				getModelMaxOutputTokens({
					modelId: model,
					model: info,
					settings: handler.options,
					format: "openai",
				}) ?? undefined
			const temperature = handler.options.modelTemperature ?? handler.defaultTemperature
			// Use Z.ai format to preserve reasoning_content and merge post-tool text into tool messages
			const convertedMessages = convertToZAiFormat(messages, { mergeToolResultText: true })
			const params: ZAiChatCompletionParams = {
				model,
				max_tokens,
				temperature,
				messages: [{ role: "system", content: systemPrompt }, ...convertedMessages],
				stream: true,
				stream_options: { include_usage: true },
				// For GLM-4.7: thinking is ON by default, so we explicitly disable when needed
				thinking: useReasoning ? { type: "enabled" } : { type: "disabled" },
				tools: handler.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
				parallel_tool_calls: metadata?.parallelToolCalls ?? true,
			}
			return handler.client.chat.completions.create(params)
		},
	}
	return handler
}
