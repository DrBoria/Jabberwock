import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@jabberwock/types"

import { type ApiHandlerOptions, getModelMaxOutputTokens } from "@shared/api"
import { TagMatcher } from "@utils/text"
import { ApiStream } from "@api/transform/stream"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import { DEFAULT_HEADERS } from "@api/providers/constants"
import { BaseProvider } from "@api/providers/base-provider"
import { handleProviderError } from "@api/providers/utils/error-handler"
import { getApiRequestTimeout } from "@api/providers/utils/timeout-config"

import type { BaseOpenAiCompatibleProviderOptions, UsageMetrics, ProviderErrorResponse } from "./types"
import { processStreamChunkBody, flushMatcher, processUsageMetrics } from "./stream-utils"

export abstract class BaseOpenAiCompatibleProvider<ModelName extends string>
	extends BaseProvider
	implements SingleCompletionHandler
{
	protected readonly providerName: string
	protected readonly baseURL: string
	protected readonly defaultTemperature: number
	protected readonly defaultProviderModelId: ModelName
	protected readonly providerModels: Record<ModelName, ModelInfo>

	protected readonly options: ApiHandlerOptions

	protected client: OpenAI

	constructor({
		providerName,
		baseURL,
		defaultProviderModelId,
		providerModels,
		defaultTemperature,
		...options
	}: BaseOpenAiCompatibleProviderOptions<ModelName>) {
		super()

		this.providerName = providerName
		this.baseURL = baseURL
		this.defaultProviderModelId = defaultProviderModelId
		this.providerModels = providerModels
		this.defaultTemperature = defaultTemperature ?? 0

		this.options = options

		if (!this.options.apiKey) {
			throw new Error("API key is required")
		}

		this.client = new OpenAI({
			baseURL,
			apiKey: this.options.apiKey,
			defaultHeaders: DEFAULT_HEADERS,
			timeout: getApiRequestTimeout(),
		})
	}

	protected buildCreateStreamParams(
		model: ModelName,
		info: ModelInfo,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
		const max_tokens =
			getModelMaxOutputTokens({
				modelId: model,
				model: info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const temperature = this.options.modelTemperature ?? info.defaultTemperature ?? this.defaultTemperature

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}

		if (this.options.enableReasoningEffort && info.supportsReasoningBinary) {
			;(params as { thinking?: { type: string } }).thinking = { type: "enabled" }
		}

		return params
	}

	protected createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const { id: model, info } = this.getModel(metadata?.modelId)
		const params = this.buildCreateStreamParams(model, info, systemPrompt, messages, metadata)

		try {
			return this.client.chat.completions.create(params, requestOptions)
		} catch (error) {
			throw handleProviderError(error, this.providerName)
		}
	}

	private throwProviderError(response: ProviderErrorResponse): void {
		throw new Error(
			`${this.providerName} API Error (${response.base_resp!.status_code}): ${response.base_resp!.status_msg || "Unknown error"}`,
		)
	}

	private checkBaseRespError(chunk: unknown): void {
		const resp = chunk as ProviderErrorResponse
		if (resp.base_resp?.status_code && resp.base_resp.status_code !== 0) {
			this.throwProviderError(resp)
		}
	}

	private *processStreamChunk(
		matcher: TagMatcher<{ type: "reasoning" | "text"; text: string }>,
		activeToolCallIds: Set<string>,
		chunk: OpenAI.Chat.Completions.ChatCompletionChunk,
	): Generator<
		| { type: "text"; text: string }
		| { type: "reasoning"; text: string }
		| import("./types").ToolCallPartial
		| { type: "tool_call_end"; id: string }
	> {
		this.checkBaseRespError(chunk)

		const delta = chunk.choices?.[0]?.delta
		const finishReason = chunk.choices?.[0]?.finish_reason

		const streamChunks = processStreamChunkBody(
			delta as Record<string, unknown> | undefined,
			finishReason,
			matcher,
			activeToolCallIds,
		)
		for (const processedChunk of streamChunks) {
			yield processedChunk
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const stream = await this.createStream(systemPrompt, messages, metadata)

		const matcher = new TagMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		let lastUsage: OpenAI.CompletionUsage | undefined
		const activeToolCallIds = new Set<string>()

		for await (const chunk of stream) {
			yield* this.processStreamChunk(matcher, activeToolCallIds, chunk)

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield processUsageMetrics(lastUsage as UsageMetrics, this.getModel(metadata?.modelId).info)
		}

		const finalChunks = flushMatcher(matcher)
		for (const processedChunk of finalChunks) {
			yield processedChunk
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info: modelInfo } = this.getModel()
		const params = this.buildCompletePromptParams(modelId, modelInfo, prompt)

		try {
			const response = await this.client.chat.completions.create(params)
			this.checkBaseRespError(response)
			if (!("choices" in response)) {
				return ""
			}
			return response.choices?.[0]?.message.content || ""
		} catch (error) {
			throw handleProviderError(error, this.providerName)
		}
	}

	private buildCompletePromptParams(
		modelId: ModelName,
		modelInfo: ModelInfo,
		prompt: string,
	): OpenAI.Chat.Completions.ChatCompletionCreateParams {
		const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
			model: modelId,
			messages: [{ role: "user", content: prompt }],
		}

		if (this.options.enableReasoningEffort && modelInfo.supportsReasoningBinary) {
			;(params as { thinking?: { type: string } }).thinking = { type: "enabled" }
		}

		return params
	}

	override getModel(modelIdOverride?: string) {
		const id =
			(modelIdOverride || this.options.apiModelId) &&
			(modelIdOverride || this.options.apiModelId)! in this.providerModels
				? ((modelIdOverride || this.options.apiModelId) as ModelName)
				: this.defaultProviderModelId

		return { id, info: this.providerModels[id] }
	}
}
