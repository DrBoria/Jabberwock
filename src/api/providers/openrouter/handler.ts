import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelRecord, openRouterDefaultModelId } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import type { ApiStreamChunk } from "@api/transform/stream"

import { getModels } from "@api/providers/fetchers/modelCache"
import { getModelEndpoints } from "@api/providers/fetchers/modelEndpointCache"

import { DEFAULT_HEADERS } from "@api/providers/constants"
import { BaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "@api/index"
import { generateImageWithProvider, ImageGenerationResult } from "@api/providers/utils/image-generation"

import { type OpenRouterError, type CompletionUsage } from "./types"
import {
	type StreamContext,
	createStreamContext,
	processStreamChunk,
	buildUsageChunk,
	consolidateStreamedReasoning,
} from "./stream"
import {
	handleStreamingError,
	handleRequestError,
	buildRequestOptions,
	buildProviderConfig,
	prepareCreateMessage,
	executeStreamRequest,
} from "./helpers"
import { executeCompletePrompt, buildModelResult } from "./complete"

export class OpenRouterHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	protected models: ModelRecord = {}
	protected endpoints: ModelRecord = {}
	private readonly providerName = "OpenRouter"
	private currentReasoningDetails: Array<{
		type: string
		text?: string
		summary?: string
		data?: string
		id?: string | null
		format?: string
		signature?: string
		index: number
	}> = []

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
		const apiKey = this.options.openRouterApiKey ?? "not-provided"

		this.client = new OpenAI({ baseURL, apiKey, defaultHeaders: DEFAULT_HEADERS })

		this.loadDynamicModels().catch((error) => {
			console.error("[jabberwock] [OpenRouterHandler] Failed to load dynamic models:", error)
		})
	}

	private async loadDynamicModels(): Promise<void> {
		try {
			const [models, endpoints] = await Promise.all([
				getModels({ provider: "openrouter" }),
				getModelEndpoints({
					router: "openrouter",
					modelId: this.options.openRouterModelId,
					endpoint: this.options.openRouterSpecificProvider,
				}),
			])

			this.models = models
			this.endpoints = endpoints
		} catch (error) {
			console.error("[jabberwock] [OpenRouterHandler] Error loading dynamic models:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})
		}
	}

	getReasoningDetails():
		| Array<{
				type: string
				text?: string
				summary?: string
				data?: string
				id?: string | null
				format?: string
				signature?: string
				index: number
		  }>
		| undefined {
		return this.currentReasoningDetails.length > 0 ? this.currentReasoningDetails : undefined
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): AsyncGenerator<ApiStreamChunk> {
		const model = await this.fetchModel()
		let { id: modelId, maxTokens, temperature, topP, reasoning } = model

		this.currentReasoningDetails = []

		if (
			(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
			typeof reasoning === "undefined"
		) {
			reasoning = { exclude: true }
		}

		const openAiMessages = prepareCreateMessage(systemPrompt, messages, modelId, reasoning)
		const tools = metadata?.tools ? this.convertToolsForOpenAI(metadata.tools) : undefined
		const stream = await executeStreamRequest(
			this.client,
			modelId,
			maxTokens,
			temperature,
			topP,
			reasoning,
			openAiMessages,
			tools,
			metadata?.tool_choice,
			this.options.openRouterSpecificProvider,
			this.providerName,
		)

		if (!stream) return

		const lastUsage: CompletionUsage | undefined = yield* this.processStreamLoop(stream, modelId)

		const usageChunk = buildUsageChunk(lastUsage)
		if (usageChunk) {
			yield usageChunk
		}
	}

	private async *processStreamLoop(
		stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
		modelId: string,
	): AsyncGenerator<ApiStreamChunk, CompletionUsage | undefined, undefined> {
		const streamCtx = createStreamContext()
		let lastUsage: CompletionUsage | undefined

		for await (const chunk of stream) {
			if ("error" in chunk) {
				handleStreamingError(chunk.error as OpenRouterError, modelId, "createMessage", this.providerName)
			}

			const chunks = processStreamChunk(chunk, streamCtx)
			for (const outChunk of chunks) {
				yield outChunk
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (streamCtx.reasoningDetailsAccumulator.size > 0) {
			this.currentReasoningDetails = consolidateStreamedReasoning(
				streamCtx,
			) as typeof this.currentReasoningDetails
		}

		return lastUsage
	}

	public async fetchModel() {
		const [models, endpoints] = await Promise.all([
			getModels({ provider: "openrouter" }),
			getModelEndpoints({
				router: "openrouter",
				modelId: this.options.openRouterModelId,
				endpoint: this.options.openRouterSpecificProvider,
			}),
		])

		this.models = models
		this.endpoints = endpoints

		return this.getModel()
	}

	override getModel() {
		const id = this.options.openRouterModelId ?? openRouterDefaultModelId
		return buildModelResult(id, this.models, this.endpoints, this.options)
	}

	async completePrompt(prompt: string) {
		const { id: modelId, maxTokens, temperature, reasoning } = await this.fetchModel()
		return executeCompletePrompt(
			this.client,
			modelId,
			maxTokens,
			temperature,
			reasoning,
			prompt,
			this.options.openRouterSpecificProvider,
			this.providerName,
		)
	}

	async generateImage(
		prompt: string,
		model: string,
		apiKey: string,
		inputImage?: string,
	): Promise<ImageGenerationResult> {
		if (!apiKey) {
			return {
				success: false,
				error: "OpenRouter API key is required for image generation",
			}
		}

		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"

		return generateImageWithProvider({
			baseURL,
			authToken: apiKey,
			model,
			prompt,
			inputImage,
		})
	}
}
