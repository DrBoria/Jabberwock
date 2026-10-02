import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { rooDefaultModelId, type ImageGenerationApiMethod } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"
import { ApiStream } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"
import type { ReasoningDetail } from "@api/transform/openai-format-types"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { getRooReasoning } from "@api/transform/content/reasoning"

import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { BaseOpenAiCompatibleProvider } from "@api/providers/openai-base/index"
import { getModelsFromCache } from "@api/providers/fetchers/modelCache"
import { handleProviderError } from "@api/providers/utils/error-handler"
import {
	generateImageWithProvider,
	generateImageWithImagesApi,
	ImageGenerationResult,
} from "@api/providers/utils/image-generation"
import { t } from "@i18n"

import { getSessionToken } from "./types"
import type { RooUsage, RooChatCompletionParams, ReasoningDetailValue } from "./types"
import { processChunk } from "./reasoning"
import { emitUsageYields, buildHeaders, logStreamError, loadDynamicModels } from "./utils"

export function RooHandler(options: ApiHandlerOptions) {
	const sessionToken = options.jabberwockCloudApiKey ?? getSessionToken()

	let baseURL = process.env.JABBERWOCK_CODE_PROVIDER_URL ?? "https://api.jabberwock.com/proxy"

	// Ensure baseURL ends with /v1 for OpenAI client, but don't duplicate it
	if (!baseURL.endsWith("/v1")) {
		baseURL = `${baseURL}/v1`
	}

	const fetcherBaseURL = baseURL.endsWith("/v1") ? baseURL.slice(0, -3) : baseURL

	loadDynamicModels(fetcherBaseURL, sessionToken).catch((error) => {
		console.error("[jabberwock] [RooHandler] Failed to load dynamic models:", error)
	})

	const base = BaseOpenAiCompatibleProvider<string>({
		...options,
		providerName: "Jabberwock Cloud",
		baseURL,
		apiKey: sessionToken,
		defaultProviderModelId: rooDefaultModelId,
		providerModels: {},
	})
	const handler = {
		...base,
		fetcherBaseURL: fetcherBaseURL,
		currentReasoningDetails: [] as ReasoningDetail[],
		createStream(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
			requestOptions?: OpenAI.RequestOptions,
		) {
			const { id: model, info } = handler.getModel()
			const params = getModelParams({
				format: "openai",
				modelId: model,
				model: info,
				settings: handler.options,
				defaultTemperature: handler.defaultTemperature,
			})
			const reasoning = getRooReasoning({
				model: info,
				reasoningBudget: params.reasoningBudget,
				reasoningEffort: params.reasoningEffort,
				settings: handler.options,
			})
			const max_tokens = params.maxTokens ?? undefined
			const temperature = params.temperature ?? handler.defaultTemperature
			const rooParams: RooChatCompletionParams = {
				model,
				max_tokens,
				temperature,
				messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
				stream: true,
				stream_options: { include_usage: true },
				...(reasoning && { reasoning }),
				tools: handler.convertToolsForOpenAI(metadata?.tools),
				tool_choice: metadata?.tool_choice,
			}
			try {
				handler.client.apiKey = handler.options.jabberwockCloudApiKey ?? getSessionToken()
				return handler.client.chat.completions.create(rooParams, requestOptions)
			} catch (error) {
				throw handleProviderError(error, handler.providerName)
			}
		},
		getReasoningDetails(): ReasoningDetail[] | undefined {
			return handler.currentReasoningDetails.length > 0 ? handler.currentReasoningDetails : undefined
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			try {
				handler.currentReasoningDetails = []
				const headers = buildHeaders(metadata)
				const stream = await handler.createStream(systemPrompt, messages, metadata, { headers })
				let lastUsage: RooUsage | undefined
				const reasoningDetailsAccumulator = new Map<string, ReasoningDetailValue>()
				let hasYieldedReasoningFromDetails = false
				for await (const chunk of stream) {
					const result = processChunk(chunk, reasoningDetailsAccumulator, hasYieldedReasoningFromDetails)
					for (const item of result.yields) {
						yield item
					}
					hasYieldedReasoningFromDetails = result.hasYieldedReasoning
					if (result.lastUsage) {
						lastUsage = result.lastUsage
					}
				}
				if (reasoningDetailsAccumulator.size > 0) {
					handler.currentReasoningDetails = Array.from(reasoningDetailsAccumulator.values())
				}
				if (lastUsage) {
					const model = handler.getModel()
					const usageYields = emitUsageYields(lastUsage, model)
					for (const item of usageYields) {
						yield item
					}
				}
			} catch (error) {
				const modelId = handler.options.apiModelId
				const hasTaskId = Boolean(metadata?.taskId)
				logStreamError(error, modelId, hasTaskId)
				throw error
			}
		},
		async completePrompt(prompt: string): Promise<string> {
			handler.client.apiKey = handler.options.jabberwockCloudApiKey ?? getSessionToken()
			return base.completePrompt(prompt)
		},
		getModel() {
			const modelId = handler.options.apiModelId || rooDefaultModelId
			const models = getModelsFromCache("jabberwock") || {}
			const modelInfo = models[modelId]
			if (modelInfo) {
				return { id: modelId, info: modelInfo }
			}
			const fallbackInfo = {
				maxTokens: 16384,
				contextWindow: 262144,
				supportsImages: false,
				supportsReasoningEffort: false,
				supportsPromptCache: true,
				inputPrice: 0,
				outputPrice: 0,
				isFree: false,
			}
			return {
				id: modelId,
				info: fallbackInfo,
			}
		},
		async generateImage(
			prompt: string,
			model: string,
			inputImage?: string,
			apiMethod?: ImageGenerationApiMethod,
		): Promise<ImageGenerationResult> {
			const sessionToken = handler.options.jabberwockCloudApiKey ?? getSessionToken()
			if (!sessionToken || sessionToken === "unauthenticated") {
				return {
					success: false,
					error: t("tools:generateImage.jabberwock.authRequired"),
				}
			}
			const baseURL = `${handler.fetcherBaseURL}/v1`
			if (apiMethod === "images_api") {
				return generateImageWithImagesApi({
					baseURL,
					authToken: sessionToken,
					model,
					prompt,
					inputImage,
					outputFormat: "png",
				})
			}
			return generateImageWithProvider({
				baseURL,
				authToken: sessionToken,
				model,
				prompt,
				inputImage,
			})
		},
	}
	return handler
}
