import { Anthropic } from "@anthropic-ai/sdk"
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/streaming"
import { CacheControlEphemeral } from "@anthropic-ai/sdk/resources"
import {
	type AnthropicModelId,
	anthropicDefaultModelId,
	anthropicModels,
	ANTHROPIC_DEFAULT_MAX_TOKENS,
	ApiProviderError,
} from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import type { ApiHandlerOptions } from "@shared/api"
import { ApiStream } from "@api/transform/stream"
import { getModelParams } from "@api/transform/model-params"
import { filterNonAnthropicBlocks } from "@api/transform/format/anthropic-filter"
import { createBaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { convertOpenAIToolsToAnthropic, convertOpenAIToolChoiceToAnthropic } from "@features/settings/context/tools"
import {
	CACHEABLE_MODELS,
	_1M_CONTEXT_MODELS,
	add1MContextBeta,
	getAnthropicRequestOptions,
	buildCacheableMessages,
	buildCacheableStreamParams,
	buildDefaultStreamParams,
} from "./params"
import { get1MContextTier } from "./1m-context-tier"
import { processAnthropicStream } from "./main"

export function AnthropicHandler(options: ApiHandlerOptions) {
	let providerName = "Anthropic"
	const apiKeyFieldName = options.anthropicBaseUrl && options.anthropicUseAuthToken ? "authToken" : "apiKey"
	const client = new Anthropic({
		baseURL: options.anthropicBaseUrl || undefined,
		[apiKeyFieldName]: options.apiKey,
	})

	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		client: client,
		providerName: providerName,
		handleStreamError(error: unknown, modelId: string): never {
			getTelemetryService().captureException(
				new ApiProviderError(
					error instanceof Error ? error.message : String(error),
					handler.providerName,
					modelId,
					"createMessage",
				),
			)
			throw error
		},
		async createStreamForModel(
			modelId: string,
			maxTokens: number | undefined,
			temperature: number | undefined,
			thinking: Anthropic.Messages.MessageStreamParams["thinking"],
			systemPrompt: string,
			sanitizedMessages: Anthropic.Messages.MessageParam[],
			betas: string[],
			cacheControl: CacheControlEphemeral,
			nativeToolParams: {
				tools: Anthropic.Messages.Tool[]
				tool_choice?: Anthropic.Messages.ToolChoice
			},
		): Promise<AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>> {
			if (CACHEABLE_MODELS.has(modelId)) {
				const cachedMessages = buildCacheableMessages(sanitizedMessages, cacheControl)
				const params = buildCacheableStreamParams(
					modelId,
					maxTokens,
					temperature,
					thinking,
					systemPrompt,
					cacheControl,
					cachedMessages,
					nativeToolParams,
					ANTHROPIC_DEFAULT_MAX_TOKENS,
				)
				const requestOptions = getAnthropicRequestOptions(betas, modelId)
				return (await handler.client.messages.create(
					params,
					requestOptions,
				)) as AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>
			}
			const params = buildDefaultStreamParams(
				modelId,
				maxTokens,
				temperature,
				systemPrompt,
				sanitizedMessages,
				nativeToolParams,
				ANTHROPIC_DEFAULT_MAX_TOKENS,
			)
			return (await handler.client.messages.create(
				params,
			)) as AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const cacheControl: CacheControlEphemeral = { type: "ephemeral" }
			const {
				id: modelId,
				betas = ["fine-grained-tool-streaming-2025-05-14"],
				maxTokens,
				temperature,
				reasoning: thinking,
			} = handler.getModel(metadata?.modelId)
			const sanitizedMessages = filterNonAnthropicBlocks(messages)
			add1MContextBeta(betas, modelId, handler.options.anthropicBeta1MContext)
			const nativeToolParams = {
				tools: convertOpenAIToolsToAnthropic(metadata?.tools ?? []),
				tool_choice: convertOpenAIToolChoiceToAnthropic(metadata?.tool_choice, metadata?.parallelToolCalls),
			}
			let stream: AnthropicStream<Anthropic.Messages.RawMessageStreamEvent> | undefined
			try {
				stream = await handler.createStreamForModel(
					modelId,
					maxTokens,
					temperature,
					thinking,
					systemPrompt,
					sanitizedMessages,
					betas,
					cacheControl,
					nativeToolParams,
				)
			} catch (error) {
				handler.handleStreamError(error, modelId)
			}
			if (!stream) throw new Error("stream creation failed")
			yield* processAnthropicStream(stream, () => handler.getModel(metadata?.modelId))
		},
		getModel(modelIdOverride?: string) {
			const modelId = modelIdOverride || handler.options.apiModelId
			const id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId
			let info = anthropicModels[id]
			if (_1M_CONTEXT_MODELS.has(id) && handler.options.anthropicBeta1MContext) {
				const tier = get1MContextTier(info)
				if (tier) {
					info = { ...info, ...tier } as typeof info
				}
			}
			const params = getModelParams({
				format: "anthropic",
				modelId: id,
				model: info,
				settings: handler.options,
				defaultTemperature: 0,
			})
			return {
				id: id === "claude-3-7-sonnet-20250219:thinking" ? "claude-3-7-sonnet-20250219" : id,
				info,
				betas: id === "claude-3-7-sonnet-20250219:thinking" ? ["output-128k-2025-02-19"] : undefined,
				...params,
			}
		},
		async completePrompt(prompt: string) {
			const { id: model, temperature } = handler.getModel()
			let message
			try {
				message = await handler.client.messages.create({
					model,
					max_tokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
					thinking: undefined,
					temperature,
					messages: [{ role: "user", content: prompt }],
					stream: false,
				})
			} catch (error) {
				getTelemetryService().captureException(
					new ApiProviderError(
						error instanceof Error ? error.message : String(error),
						handler.providerName,
						model,
						"completePrompt",
					),
				)
				throw error
			}
			const content = message.content.find(({ type }: { type: string }) => type === "text")
			return content?.type === "text" ? content.text : ""
		},
	}
	return handler
}
