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
import { BaseOpenAiCompatibleProvider } from "@api/providers/base-openai-compatible-provider"
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

export class RooHandler extends BaseOpenAiCompatibleProvider<string> {
	private fetcherBaseURL: string
	private currentReasoningDetails: ReasoningDetail[] = []

	constructor(options: ApiHandlerOptions) {
		const sessionToken = options.jabberwockCloudApiKey ?? getSessionToken()

		let baseURL = process.env.JABBERWOCK_CODE_PROVIDER_URL ?? "https://api.jabberwock.com/proxy"

		// Ensure baseURL ends with /v1 for OpenAI client, but don't duplicate it
		if (!baseURL.endsWith("/v1")) {
			baseURL = `${baseURL}/v1`
		}

		super({
			...options,
			providerName: "Jabberwock Cloud",
			baseURL,
			apiKey: sessionToken,
			defaultProviderModelId: rooDefaultModelId,
			providerModels: {},
		})

		this.fetcherBaseURL = baseURL.endsWith("/v1") ? baseURL.slice(0, -3) : baseURL

		loadDynamicModels(this.fetcherBaseURL, sessionToken).catch((error) => {
			console.error("[jabberwock] [RooHandler] Failed to load dynamic models:", error)
		})
	}

	protected override createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const { id: model, info } = this.getModel()

		const params = getModelParams({
			format: "openai",
			modelId: model,
			model: info,
			settings: this.options,
			defaultTemperature: this.defaultTemperature,
		})

		const reasoning = getRooReasoning({
			model: info,
			reasoningBudget: params.reasoningBudget,
			reasoningEffort: params.reasoningEffort,
			settings: this.options,
		})

		const max_tokens = params.maxTokens ?? undefined
		const temperature = params.temperature ?? this.defaultTemperature

		const rooParams: RooChatCompletionParams = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			...(reasoning && { reasoning }),
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
		}

		try {
			this.client.apiKey = this.options.jabberwockCloudApiKey ?? getSessionToken()
			return this.client.chat.completions.create(rooParams, requestOptions)
		} catch (error) {
			throw handleProviderError(error, this.providerName)
		}
	}

	getReasoningDetails(): ReasoningDetail[] | undefined {
		return this.currentReasoningDetails.length > 0 ? this.currentReasoningDetails : undefined
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		try {
			this.currentReasoningDetails = []

			const headers = buildHeaders(metadata)

			const stream = await this.createStream(systemPrompt, messages, metadata, { headers })

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
				this.currentReasoningDetails = Array.from(reasoningDetailsAccumulator.values())
			}

			if (lastUsage) {
				const model = this.getModel()
				const usageYields = emitUsageYields(lastUsage, model)
				for (const item of usageYields) {
					yield item
				}
			}
		} catch (error) {
			const modelId = this.options.apiModelId
			const hasTaskId = Boolean(metadata?.taskId)
			logStreamError(error, modelId, hasTaskId)
			throw error
		}
	}

	override async completePrompt(prompt: string): Promise<string> {
		this.client.apiKey = this.options.jabberwockCloudApiKey ?? getSessionToken()
		return super.completePrompt(prompt)
	}

	override getModel() {
		const modelId = this.options.apiModelId || rooDefaultModelId

		const models = getModelsFromCache("jabberwock") || {}
		const modelInfo = models[modelId]

		if (modelInfo) {
			return { id: modelId, info: modelInfo }
		}

		const fallbackInfo = {
			maxTokens: 16_384,
			contextWindow: 262_144,
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
	}

	async generateImage(
		prompt: string,
		model: string,
		inputImage?: string,
		apiMethod?: ImageGenerationApiMethod,
	): Promise<ImageGenerationResult> {
		const sessionToken = this.options.jabberwockCloudApiKey ?? getSessionToken()

		if (!sessionToken || sessionToken === "unauthenticated") {
			return {
				success: false,
				error: t("tools:generateImage.jabberwock.authRequired"),
			}
		}

		const baseURL = `${this.fetcherBaseURL}/v1`

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
	}
}
