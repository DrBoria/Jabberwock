import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import axios from "axios"

import { type ModelInfo, openAiModelInfoSaneDefaults, LMSTUDIO_DEFAULT_TEMPERATURE } from "@jabberwock/types"

import type { ApiHandlerOptions } from "@shared/api"

import { TagMatcher } from "@utils/text"

import { convertToOpenAiMessages } from "@api/transform/format/openai-format"
import { ApiStream } from "@api/transform/stream"

import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import { getModelsFromCache } from "@api/providers/fetchers/modelCache"
import { getApiRequestTimeout } from "@api/providers/utils/timeout-config"
import { handleProviderError } from "@api/providers/utils/error-handler"

export class LmStudioHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "LM Studio"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const apiKey = "noop"

		this.client = new OpenAI({
			baseURL: (this.options.lmStudioBaseUrl || "http://localhost:1234") + "/v1",
			apiKey: apiKey,
			timeout: getApiRequestTimeout(),
		})
	}

	private buildLmStudioStreamParams(
		metadata: ApiHandlerCreateMessageMetadata | undefined,
		openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
	): OpenAI.Chat.ChatCompletionCreateParamsStreaming & { draft_model?: string } {
		const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming & { draft_model?: string } = {
			model: this.getModel().id,
			messages: openAiMessages,
			temperature: this.options.modelTemperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
			stream: true,
			tools: this.convertToolsForOpenAI(metadata?.tools),
			tool_choice: metadata?.tool_choice,
			parallel_tool_calls: metadata?.parallelToolCalls ?? true,
		}

		if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
			params.draft_model = this.options.lmStudioDraftModelId
		}

		return params
	}

	private async countMessageTokens(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): Promise<number> {
		const toContentBlocks = (
			blocks: Anthropic.Messages.MessageParam[] | string,
		): Anthropic.Messages.ContentBlockParam[] => {
			if (typeof blocks === "string") {
				return [{ type: "text", text: blocks }]
			}

			const result: Anthropic.Messages.ContentBlockParam[] = []
			for (const msg of blocks) {
				if (typeof msg.content === "string") {
					result.push({ type: "text", text: msg.content })
				} else if (Array.isArray(msg.content)) {
					for (const part of msg.content) {
						if (part.type === "text") {
							result.push({ type: "text", text: part.text })
						}
					}
				}
			}
			return result
		}

		try {
			return await this.countTokens([{ type: "text", text: systemPrompt }, ...toContentBlocks(messages)])
		} catch {
			return 0
		}
	}

	private *processLmStudioToolCalls(
		delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined,
	): Generator<{ type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }> {
		if (delta?.tool_calls) {
			for (const toolCall of delta.tool_calls) {
				yield {
					type: "tool_call_partial",
					index: toolCall.index,
					id: toolCall.id,
					name: toolCall.function?.name,
					arguments: toolCall.function?.arguments,
				}
			}
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const inputTokens = await this.countMessageTokens(systemPrompt, messages)

		let assistantText = ""

		try {
			const params = this.buildLmStudioStreamParams(metadata, openAiMessages)

			let results
			try {
				results = await this.client.chat.completions.create(params)
			} catch (error) {
				throw handleProviderError(error, this.providerName)
			}

			const matcher = new TagMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

			for await (const chunk of results) {
				const delta = chunk.choices[0]?.delta

				if (delta?.content) {
					assistantText += delta.content
					for (const processedChunk of matcher.update(delta.content)) {
						yield processedChunk
					}
				}

				yield* this.processLmStudioToolCalls(delta)
			}

			for (const processedChunk of matcher.final()) {
				yield processedChunk
			}

			const outputTokens = await this.countMessageTokens("", [{ role: "assistant", content: assistantText }])

			yield {
				type: "usage",
				inputTokens,
				outputTokens,
			} as const
		} catch (_error) {
			throw new Error(
				"Please check the LM Studio developer logs to debug what went wrong. You may need to load the model with a larger context limit to work with Jabberwock's prompts.",
			)
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		const models = getModelsFromCache("lmstudio")
		if (models && this.options.lmStudioModelId && models[this.options.lmStudioModelId]) {
			return {
				id: this.options.lmStudioModelId,
				info: models[this.options.lmStudioModelId],
			}
		} else {
			return {
				id: this.options.lmStudioModelId || "",
				info: openAiModelInfoSaneDefaults,
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			// Create params object with optional draft model
			const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & { draft_model?: string } = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
				temperature: this.options.modelTemperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
				stream: false,
			}

			// Add draft model if speculative decoding is enabled and a draft model is specified
			if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
				params.draft_model = this.options.lmStudioDraftModelId
			}

			let response
			try {
				response = await this.client.chat.completions.create(
					params as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
				)
			} catch (error) {
				throw handleProviderError(error, this.providerName)
			}
			return response.choices[0]?.message.content || ""
		} catch (_error) {
			throw new Error(
				"Please check the LM Studio developer logs to debug what went wrong. You may need to load the model with a larger context length to work with Jabberwock's prompts.",
			)
		}
	}
}

export async function getLmStudioModels(baseUrl = "http://localhost:1234") {
	try {
		if (!URL.canParse(baseUrl)) {
			return []
		}

		const response = await axios.get(`${baseUrl}/v1/models`)
		const modelsArray = response.data?.data?.map((model: { id: string }) => model.id) || []
		return [...new Set<string>(modelsArray)]
	} catch (_error) {
		return []
	}
}
