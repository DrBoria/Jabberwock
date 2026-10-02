import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, type ModelRecord, unboundDefaultModelId, unboundDefaultModelInfo } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { ApiStream } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"
import { OpenAiReasoningParams } from "@api/transform/content/reasoning"

import { DEFAULT_HEADERS } from "@api/providers/constants"
import { getModels } from "@api/providers/fetchers/modelCache"
import { createBaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { handleProviderError } from "@api/providers/utils/error-handler"
import { applyRouterToolPreferences } from "@api/providers/utils/router-tool-preferences"

import {
	mapReasoningEffort,
	processOpenAiCompatibleChunk as processUnboundChunk,
} from "@api/providers/utils/openai-compatible-chunk"
import { UnboundChatCompletionParamsStreaming, UnboundChatCompletionParams } from "./types"
import { processUsageMetrics } from "./stream"

export function UnboundHandler(options: ApiHandlerOptions) {
	let providerName = "Unbound"
	const apiKey = options.unboundApiKey ?? "not-provided"

	const client = new OpenAI({
		baseURL: "https://api.getunbound.ai/v1",
		apiKey: apiKey,
		defaultHeaders: {
			...DEFAULT_HEADERS,
			"X-Unbound-Metadata": JSON.stringify({ labels: [{ key: "app", value: "jabberwock" }] }),
		},
	})

	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		models: {} as ModelRecord,
		client: client,
		providerName: providerName,
		async fetchModel() {
			handler.models = await getModels({ provider: "unbound", apiKey: handler.options.unboundApiKey })
			return handler.getModel()
		},
		getModel() {
			const id = handler.options.unboundModelId ?? unboundDefaultModelId
			const cachedInfo = handler.models[id] ?? unboundDefaultModelInfo
			let info: ModelInfo = cachedInfo
			// Apply tool preferences for models accessed through routers (OpenAI, Gemini)
			info = applyRouterToolPreferences(id, info)
			const params = getModelParams({
				format: "openai",
				modelId: id,
				model: info,
				settings: handler.options,
				defaultTemperature: 0,
			})
			return { id, info, ...params }
		},
		buildUnboundCompletionParams(
			model: string,
			openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
			max_tokens: number | undefined,
			temperature: number | undefined,
			allowedEffort: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming["reasoning_effort"],
			thinking: OpenAiReasoningParams | undefined,
			metadata: ApiHandlerCreateMessageMetadata | undefined,
		): UnboundChatCompletionParamsStreaming {
			return {
				messages: openAiMessages,
				model,
				max_tokens,
				temperature,
				...(allowedEffort && { reasoning_effort: allowedEffort }),
				...(thinking && { thinking }),
				stream: true,
				stream_options: { include_usage: true },
				unbound_metadata: { originApp: "jabberwock", taskId: metadata?.taskId, mode: metadata?.mode },
				tools: handler.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
			}
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const {
				id: model,
				info,
				maxTokens: max_tokens,
				temperature,
				reasoningEffort: reasoning_effort,
				reasoning: thinking,
			} = await handler.fetchModel()
			const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
				{ role: "system", content: systemPrompt },
				...convertToOpenAiMessages(messages),
			]
			const allowedEffort = mapReasoningEffort(reasoning_effort)
			const completionParams = handler.buildUnboundCompletionParams(
				model,
				openAiMessages,
				max_tokens,
				temperature,
				allowedEffort,
				thinking,
				metadata,
			)
			let stream
			try {
				stream = await handler.client.chat.completions.create(completionParams)
			} catch (error) {
				throw handleProviderError(error, handler.providerName)
			}
			let lastUsage: OpenAI.CompletionUsage | undefined
			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta
				lastUsage = yield* processUnboundChunk(delta, chunk)
			}
			if (lastUsage) {
				yield processUsageMetrics(lastUsage, info)
			}
		},
		async completePrompt(prompt: string): Promise<string> {
			const { id: model, maxTokens: max_tokens, temperature } = await handler.fetchModel()
			let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: prompt }]
			const completionParams: UnboundChatCompletionParams = {
				model,
				max_tokens,
				messages: openAiMessages,
				temperature: temperature,
			}
			let response: OpenAI.Chat.ChatCompletion
			try {
				response = await handler.client.chat.completions.create(completionParams)
			} catch (error) {
				throw handleProviderError(error, handler.providerName)
			}
			return response.choices[0]?.message.content || ""
		},
	}
	return handler
}
