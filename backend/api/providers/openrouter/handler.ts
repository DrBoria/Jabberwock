import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelRecord, openRouterDefaultModelId } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import type { ApiStreamChunk } from "@api/transform/stream"

import { getModels } from "@api/providers/fetchers/modelCache"
import { getModelEndpoints } from "@api/providers/fetchers/modelEndpointCache"

import { DEFAULT_HEADERS } from "@api/providers/constants"
import { createBaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { generateImageWithProvider, ImageGenerationResult } from "@api/providers/utils/image-generation"

import { type OpenRouterError, type CompletionUsage } from "./types"
import { createStreamContext, processStreamChunk, buildUsageChunk, consolidateStreamedReasoning } from "./stream"
import { handleStreamingError, prepareCreateMessage, executeStreamRequest } from "./helpers"
import { executeCompletePrompt, buildModelResult } from "./complete"

export function OpenRouterHandler(options: ApiHandlerOptions) {
	let providerName = "OpenRouter"
	const baseURL = options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
	const apiKey = options.openRouterApiKey ?? "not-provided"

	const client = new OpenAI({ baseURL, apiKey, defaultHeaders: DEFAULT_HEADERS })

	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		client: client,
		models: {} as ModelRecord,
		endpoints: {} as ModelRecord,
		providerName: providerName,
		currentReasoningDetails: [] as Array<{
			type: string
			text?: string
			summary?: string
			data?: string
			id?: string | null
			format?: string
			signature?: string
			index: number
		}>,
		async loadDynamicModels(): Promise<void> {
			try {
				const [models, endpoints] = await Promise.all([
					getModels({ provider: "openrouter" }),
					getModelEndpoints({
						router: "openrouter",
						modelId: handler.options.openRouterModelId,
						endpoint: handler.options.openRouterSpecificProvider,
					}),
				])
				handler.models = models
				handler.endpoints = endpoints
			} catch (error) {
				console.error("[jabberwock] [OpenRouterHandler] Error loading dynamic models:", {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				})
			}
		},
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
			return handler.currentReasoningDetails.length > 0 ? handler.currentReasoningDetails : undefined
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): AsyncGenerator<ApiStreamChunk> {
			const model = await handler.fetchModel()
			let { id: modelId, maxTokens, temperature, topP, reasoning } = model
			handler.currentReasoningDetails = []
			if (
				(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
				typeof reasoning === "undefined"
			) {
				reasoning = { exclude: true }
			}
			const openAiMessages = prepareCreateMessage(systemPrompt, messages, modelId, reasoning)
			const tools = metadata?.tools ? handler.convertToolsForOpenAI(metadata.tools) : undefined
			const stream = await executeStreamRequest(
				handler.client,
				modelId,
				maxTokens,
				temperature,
				topP,
				reasoning,
				openAiMessages,
				tools,
				metadata?.tool_choice,
				handler.options.openRouterSpecificProvider,
				handler.providerName,
			)
			if (!stream) return
			const lastUsage: CompletionUsage | undefined = yield* handler.processStreamLoop(stream, modelId)
			const usageChunk = buildUsageChunk(lastUsage)
			if (usageChunk) {
				yield usageChunk
			}
		},
		async *processStreamLoop(
			stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
			modelId: string,
		): AsyncGenerator<ApiStreamChunk, CompletionUsage | undefined, undefined> {
			const streamCtx = createStreamContext()
			let lastUsage: CompletionUsage | undefined
			for await (const chunk of stream) {
				if ("error" in chunk) {
					handleStreamingError(chunk.error as OpenRouterError, modelId, "createMessage", handler.providerName)
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
				handler.currentReasoningDetails = consolidateStreamedReasoning(
					streamCtx,
				) as typeof handler.currentReasoningDetails
			}
			return lastUsage
		},
		async fetchModel() {
			const [models, endpoints] = await Promise.all([
				getModels({ provider: "openrouter" }),
				getModelEndpoints({
					router: "openrouter",
					modelId: handler.options.openRouterModelId,
					endpoint: handler.options.openRouterSpecificProvider,
				}),
			])
			handler.models = models
			handler.endpoints = endpoints
			return handler.getModel()
		},
		getModel() {
			const id = handler.options.openRouterModelId ?? openRouterDefaultModelId
			return buildModelResult(id, handler.models, handler.endpoints, handler.options)
		},
		async completePrompt(prompt: string) {
			const { id: modelId, maxTokens, temperature, reasoning } = await handler.fetchModel()
			return executeCompletePrompt(
				handler.client,
				modelId,
				maxTokens,
				temperature,
				reasoning,
				prompt,
				handler.options.openRouterSpecificProvider,
				handler.providerName,
			)
		},
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
			const baseURL = handler.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
			return generateImageWithProvider({
				baseURL,
				authToken: apiKey,
				model,
				prompt,
				inputImage,
			})
		},
	}
	handler.loadDynamicModels().catch((error) => {
		console.error("[jabberwock] [OpenRouterHandler] Failed to load dynamic models:", error)
	})
	return handler
}
