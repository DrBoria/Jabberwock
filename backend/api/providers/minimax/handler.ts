import { Anthropic } from "@anthropic-ai/sdk"

import { CacheControlEphemeral } from "@anthropic-ai/sdk/resources"

import { type MinimaxModelId, minimaxDefaultModelId, minimaxModels } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import { ApiStream } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"
import { mergeEnvironmentDetailsForMiniMax } from "@api/transform/format/minimax-format"

import { createBaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { convertOpenAIToolsToAnthropic } from "@features/settings/context/tools"

import { convertOpenAIToolChoice, buildSystemBlocks, addCacheControl, maybeEmitFinalCost } from "./utils"
import { handleStreamEvent } from "./stream"

export function MiniMaxHandler(options: ApiHandlerOptions) {
	// Use Anthropic-compatible endpoint
	// Default to international endpoint: https://api.minimax.io/anthropic
	// China endpoint: https://api.minimaxi.com/anthropic
	let baseURL = options.minimaxBaseUrl || "https://api.minimax.io/anthropic"

	// If user provided a /v1 endpoint, convert to /anthropic
	if (baseURL.endsWith("/v1")) {
		baseURL = baseURL.replace(/\/v1$/, "/anthropic")
	} else if (!baseURL.endsWith("/anthropic")) {
		baseURL = `${baseURL.replace(/\/$/, "")}/anthropic`
	}

	const client = new Anthropic({
		baseURL,
		apiKey: options.minimaxApiKey,
	})

	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		client: client,
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const cacheControl: CacheControlEphemeral = { type: "ephemeral" }
			const { id: modelId, info, maxTokens, temperature } = handler.getModel()
			// MiniMax M2 models support prompt caching
			const supportsPromptCache = info.supportsPromptCache ?? false
			// Merge environment_details from "messages" that follow tool_result blocks
			// into the tool_result content.
			const processedMessages = mergeEnvironmentDetailsForMiniMax(messages)
			// Build the system blocks array
			const systemBlocks = buildSystemBlocks(systemPrompt, supportsPromptCache, cacheControl)
			// Prepare request parameters
			const requestParams = handler.buildRequestParams(
				modelId,
				maxTokens,
				temperature,
				systemBlocks,
				processedMessages,
				supportsPromptCache,
				cacheControl,
				metadata,
			)
			const stream = (await handler.client.messages.create(
				requestParams,
			)) as AsyncIterable<Anthropic.Messages.RawMessageStreamEvent>
			const state = {
				inputTokens: 0,
				outputTokens: 0,
				cacheWriteTokens: 0,
				cacheReadTokens: 0,
			}
			for await (const chunk of stream) {
				yield* handleStreamEvent(chunk, state)
			}
			yield* maybeEmitFinalCost(state, handler.getModel().info)
		},
		buildRequestParams(
			modelId: string,
			maxTokens: number | undefined,
			temperature: number | undefined,
			systemBlocks: Anthropic.Messages.TextBlockParam[],
			processedMessages: Anthropic.Messages.MessageParam[],
			supportsPromptCache: boolean,
			cacheControl: CacheControlEphemeral,
			metadata?: ApiHandlerCreateMessageMetadata,
		): Anthropic.Messages.MessageCreateParams {
			return {
				model: modelId,
				max_tokens: maxTokens ?? 16384,
				temperature: temperature ?? 1.0,
				system: systemBlocks,
				messages: supportsPromptCache ? addCacheControl(processedMessages, cacheControl) : processedMessages,
				stream: true,
				tools: convertOpenAIToolsToAnthropic(metadata?.tools ?? []),
				tool_choice: convertOpenAIToolChoice(metadata?.tool_choice),
			}
		},
		getModel() {
			const modelId = handler.options.apiModelId
			const id = modelId && modelId in minimaxModels ? (modelId as MinimaxModelId) : minimaxDefaultModelId
			const info = minimaxModels[id]
			const params = getModelParams({
				format: "anthropic",
				modelId: id,
				model: info,
				settings: handler.options,
				defaultTemperature: 1.0,
			})
			return {
				id,
				info,
				...params,
			}
		},
		async completePrompt(prompt: string) {
			const { id: model, temperature } = handler.getModel()
			const message = await handler.client.messages.create({
				model,
				max_tokens: 16384,
				temperature: temperature ?? 1.0,
				messages: [{ role: "user", content: prompt }],
				stream: false,
			})
			const content = message.content.find(({ type }) => type === "text")
			return content?.type === "text" ? content.text : ""
		},
	}
	return handler
}
