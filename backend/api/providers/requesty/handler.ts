import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, type ModelRecord, requestyDefaultModelId, requestyDefaultModelInfo } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { ApiStream } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"

import { DEFAULT_HEADERS } from "@api/providers/constants"
import { getModels } from "@api/providers/fetchers/modelCache"
import { createBaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { toRequestyServiceUrl } from "@shared/utils/requesty"
import { handleProviderError } from "@api/providers/utils/error-handler"
import { applyRouterToolPreferences } from "@api/providers/utils/router-tool-preferences"

import {
	mapReasoningEffort,
	processOpenAiCompatibleChunk as processRequestyChunk,
} from "@api/providers/utils/openai-compatible-chunk"
import { processUsageMetrics } from "./stream"
import { buildRequestyCompletionParams } from "./build-params"
import type { RequestyChatCompletionParams } from "./types"

export function RequestyHandler(options: ApiHandlerOptions) {
	let providerName = "Requesty"
	const baseURL = toRequestyServiceUrl(options.requestyBaseUrl)

	const apiKey = options.requestyApiKey ?? "not-provided"

	const client = new OpenAI({
		baseURL: baseURL,
		apiKey: apiKey,
		defaultHeaders: DEFAULT_HEADERS,
	})

	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		models: {} as ModelRecord,
		client: client,
		baseURL: baseURL,
		providerName: providerName,
		async fetchModel() {
			handler.models = await getModels({ provider: "requesty", baseUrl: handler.baseURL })
			return handler.getModel()
		},
		getModel() {
			const id = handler.options.requestyModelId ?? requestyDefaultModelId
			const cachedInfo = handler.models[id] ?? requestyDefaultModelInfo
			let info: ModelInfo = cachedInfo
			// Apply tool preferences for models accessed through routers (OpenAI, Gemini)
			info = applyRouterToolPreferences(id, info)
			const params = getModelParams({
				format: "anthropic",
				modelId: id,
				model: info,
				settings: handler.options,
				defaultTemperature: 0,
			})
			return { id, info, ...params }
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
			const completionParams = buildRequestyCompletionParams(
				model,
				openAiMessages,
				max_tokens,
				temperature,
				allowedEffort,
				thinking,
				metadata,
				(m) => handler.convertToolsForOpenAI(m),
			)
			let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
			try {
				stream = (await handler.client.chat.completions.create(
					completionParams,
				)) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
			} catch (error) {
				throw handleProviderError(error, handler.providerName)
			}
			let lastUsage: OpenAI.CompletionUsage | undefined
			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta
				lastUsage = yield* processRequestyChunk(delta, chunk)
			}
			if (lastUsage) {
				yield processUsageMetrics(lastUsage, info)
			}
		},
		async completePrompt(prompt: string): Promise<string> {
			const { id: model, maxTokens: max_tokens, temperature } = await handler.fetchModel()
			let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: prompt }]
			const completionParams: RequestyChatCompletionParams = {
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
