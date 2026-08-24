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
import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import {
	convertOpenAIToolsToAnthropic,
	convertOpenAIToolChoiceToAnthropic,
} from "@features/settings/context/tools/native-tools/converters"
import {
	CACHEABLE_MODELS,
	_1M_CONTEXT_MODELS,
	add1MContextBeta,
	getAnthropicRequestOptions,
	buildCacheableMessages,
	buildCacheableStreamParams,
	buildDefaultStreamParams,
} from "./stream-helpers"
import { get1MContextTier } from "./1m-context-tier"
import { processAnthropicStream } from "./stream"

export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: Anthropic
	private readonly providerName = "Anthropic"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		const apiKeyFieldName =
			this.options.anthropicBaseUrl && this.options.anthropicUseAuthToken ? "authToken" : "apiKey"
		this.client = new Anthropic({
			baseURL: this.options.anthropicBaseUrl || undefined,
			[apiKeyFieldName]: this.options.apiKey,
		})
	}

	private handleStreamError(error: unknown, modelId: string): never {
		getTelemetryService().captureException(
			new ApiProviderError(
				error instanceof Error ? error.message : String(error),
				this.providerName,
				modelId,
				"createMessage",
			),
		)
		throw error
	}

	private async createStreamForModel(
		modelId: string,
		maxTokens: number | undefined,
		temperature: number | undefined,
		thinking: Anthropic.Messages.MessageStreamParams["thinking"],
		systemPrompt: string,
		sanitizedMessages: Anthropic.Messages.MessageParam[],
		betas: string[],
		cacheControl: CacheControlEphemeral,
		nativeToolParams: { tools: Anthropic.Messages.Tool[]; tool_choice?: Anthropic.Messages.ToolChoice },
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
			return (await this.client.messages.create(
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
		return (await this.client.messages.create(params)) as AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>
	}

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
		} = this.getModel(metadata?.modelId)

		const sanitizedMessages = filterNonAnthropicBlocks(messages)
		add1MContextBeta(betas, modelId, this.options.anthropicBeta1MContext)

		const nativeToolParams = {
			tools: convertOpenAIToolsToAnthropic(metadata?.tools ?? []),
			tool_choice: convertOpenAIToolChoiceToAnthropic(metadata?.tool_choice, metadata?.parallelToolCalls),
		}

		let stream: AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>
		try {
			stream = await this.createStreamForModel(
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
			this.handleStreamError(error, modelId)
		}

		yield* processAnthropicStream(stream, () => this.getModel(metadata?.modelId))
	}

	getModel(modelIdOverride?: string) {
		const modelId = modelIdOverride || this.options.apiModelId
		const id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId
		let info = anthropicModels[id]

		if (_1M_CONTEXT_MODELS.has(id) && this.options.anthropicBeta1MContext) {
			const tier = get1MContextTier(info)
			if (tier) {
				info = { ...info, ...tier } as typeof info
			}
		}

		const params = getModelParams({
			format: "anthropic",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		return {
			id: id === "claude-3-7-sonnet-20250219:thinking" ? "claude-3-7-sonnet-20250219" : id,
			info,
			betas: id === "claude-3-7-sonnet-20250219:thinking" ? ["output-128k-2025-02-19"] : undefined,
			...params,
		}
	}

	async completePrompt(prompt: string) {
		const { id: model, temperature } = this.getModel()
		let message
		try {
			message = await this.client.messages.create({
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
					this.providerName,
					model,
					"completePrompt",
				),
			)
			throw error
		}
		const content = message.content.find(({ type }: { type: string }) => type === "text")
		return content?.type === "text" ? content.text : ""
	}
}
