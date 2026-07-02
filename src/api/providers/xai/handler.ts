import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type XAIModelId, xaiDefaultModelId, xaiModels, type ModelInfo, ApiProviderError } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import type { ApiHandlerOptions } from "@shared/api"

import { ApiStream } from "@api/transform/stream"
import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { getModelParams } from "@api/transform/model-params"

import { DEFAULT_HEADERS } from "@api/providers/constants"
import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import { handleProviderError } from "@api/providers/utils/error-handler"

const XAI_DEFAULT_TEMPERATURE = 0

export class XAIHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "xAI"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const apiKey = this.options.xaiApiKey ?? "not-provided"

		this.client = new OpenAI({
			baseURL: "https://api.x.ai/v1",
			apiKey: apiKey,
			defaultHeaders: DEFAULT_HEADERS,
		})
	}

	override getModel() {
		const id =
			this.options.apiModelId && this.options.apiModelId in xaiModels
				? (this.options.apiModelId as XAIModelId)
				: xaiDefaultModelId

		const info = xaiModels[id]
		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: XAI_DEFAULT_TEMPERATURE,
		})
		return { id, info, ...params }
	}

	private buildXaiRequestOptions(
		modelId: string,
		modelInfo: ModelInfo,
		reasoning: unknown,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata: ApiHandlerCreateMessageMetadata | undefined,
	): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
		const extra: Record<string, unknown> = {}
		if (reasoning && typeof reasoning === "object") {
			Object.assign(extra, reasoning)
		}
		return {
			model: modelId,
			max_tokens: modelInfo.maxTokens,
			temperature: this.options.modelTemperature ?? XAI_DEFAULT_TEMPERATURE,
			messages: [
				{ role: "system", content: systemPrompt },
				...convertToOpenAiMessages(messages),
			] as OpenAI.Chat.ChatCompletionMessageParam[],
			stream: true as const,
			stream_options: { include_usage: true },
			...extra,
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}
	}

	private *processXaiToolCalls(
		toolCalls: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[],
	): Generator<{ type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }> {
		for (const toolCall of toolCalls) {
			yield {
				type: "tool_call_partial",
				index: toolCall.index,
				id: toolCall.id,
				name: toolCall.function?.name,
				arguments: toolCall.function?.arguments,
			}
		}
	}

	private extractXaiCacheTokens(usage: OpenAI.CompletionUsage): {
		cacheReadTokens: number
		cacheWriteTokens: number
	} {
		const promptDetails = "prompt_tokens_details" in usage ? usage.prompt_tokens_details : null
		const cachedTokens = promptDetails && "cached_tokens" in promptDetails ? promptDetails.cached_tokens : 0

		const readTokens =
			cachedTokens ||
			("cache_read_input_tokens" in usage
				? ((usage as Record<string, unknown>).cache_read_input_tokens as number)
				: 0)
		const writeTokens =
			"cache_creation_input_tokens" in usage
				? ((usage as Record<string, unknown>).cache_creation_input_tokens as number)
				: 0

		return { cacheReadTokens: readTokens, cacheWriteTokens: writeTokens }
	}

	private buildXaiUsageChunk(usage: OpenAI.CompletionUsage): {
		type: "usage"
		inputTokens: number
		outputTokens: number
		cacheReadTokens: number
		cacheWriteTokens: number
	} {
		const { cacheReadTokens, cacheWriteTokens } = this.extractXaiCacheTokens(usage)

		return {
			type: "usage",
			inputTokens: usage.prompt_tokens || 0,
			outputTokens: usage.completion_tokens || 0,
			cacheReadTokens,
			cacheWriteTokens,
		}
	}

	private *processXaiChunk(
		delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined,
		chunk: OpenAI.Chat.ChatCompletionChunk,
	): Generator<
		| { type: "text"; text: string }
		| { type: "reasoning"; text: string }
		| { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
		| {
				type: "usage"
				inputTokens: number
				outputTokens: number
				cacheReadTokens: number
				cacheWriteTokens: number
		  },
		void
	> {
		if (delta?.content) {
			yield { type: "text", text: delta.content }
		}

		if (delta && "reasoning_content" in delta && delta.reasoning_content) {
			yield { type: "reasoning", text: delta.reasoning_content as string }
		}

		if (delta?.tool_calls) {
			yield* this.processXaiToolCalls(delta.tool_calls)
		}

		if (chunk.usage) {
			yield this.buildXaiUsageChunk(chunk.usage)
		}
	}

	private handleXaiError(error: unknown, modelId: string): never {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "createMessage")
		getTelemetryService().captureException(apiError)
		throw handleProviderError(error, this.providerName)
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info: modelInfo, reasoning } = this.getModel()

		const requestOptions = this.buildXaiRequestOptions(
			modelId,
			modelInfo,
			reasoning,
			systemPrompt,
			messages,
			metadata,
		)

		let stream
		try {
			stream = await this.client.chat.completions.create(requestOptions)
		} catch (error) {
			this.handleXaiError(error, modelId)
		}

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			yield* this.processXaiChunk(delta, chunk)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, reasoning } = this.getModel()

		try {
			const response = await this.client.chat.completions.create({
				model: modelId,
				messages: [{ role: "user", content: prompt }],
				...(reasoning && reasoning),
			})

			return response.choices[0]?.message.content || ""
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, this.providerName, modelId, "completePrompt")
			getTelemetryService().captureException(apiError)
			throw handleProviderError(error, this.providerName)
		}
	}
}
