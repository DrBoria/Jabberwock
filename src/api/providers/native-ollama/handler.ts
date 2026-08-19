import { Anthropic } from "@anthropic-ai/sdk"
import { Ollama, type Config as OllamaOptions } from "ollama"
import { ModelInfo, openAiModelInfoSaneDefaults, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@jabberwock/types"
import { ApiStream } from "@api/transform/stream"
import { BaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerOptions } from "@shared/api"
import { TagMatcher } from "@utils/text"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"

import { convertToOllamaMessages } from "./messages"
import { OllamaChatOptions } from "./types"
import { convertToolsToOllama, buildChatOptions, handleOllamaError } from "./utils"
import { processOllamaStream } from "./stream"
import { getOllamaModels } from "@api/providers/fetchers/providers/ollama"

export class NativeOllamaHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: Ollama | undefined
	protected models: Record<string, ModelInfo> = {}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	private ensureClient(): Ollama {
		if (!this.client) {
			try {
				const clientOptions: OllamaOptions = {
					host: this.options.ollamaBaseUrl || "http://localhost:11434",
				}

				if (this.options.ollamaApiKey) {
					clientOptions.headers = {
						Authorization: `Bearer ${this.options.ollamaApiKey}`,
					}
				}

				this.client = new Ollama(clientOptions)
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				throw new Error(`Error creating Ollama client: ${message}`)
			}
		}
		return this.client
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const client = this.ensureClient()
		const { id: modelId } = await this.fetchModel()
		const useR1Format = modelId.toLowerCase().includes("deepseek-r1")

		const ollamaMessages: import("ollama").Message[] = [
			{ role: "system", content: systemPrompt },
			...convertToOllamaMessages(messages),
		]

		const matcher = new TagMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		try {
			const chatOptions = buildChatOptions(
				{
					ollamaNumCtx: this.options.ollamaNumCtx,
					modelTemperature: this.options.modelTemperature ?? undefined,
				},
				useR1Format,
			)

			console.log(
				`[NativeOllamaHandler] Starting stream for model "${modelId}" with ${ollamaMessages.length} messages and num_ctx=${chatOptions.num_ctx ?? "default"}`,
			)

			const stream = await client.chat({
				model: modelId,
				messages: ollamaMessages,
				stream: true,
				options: chatOptions,
				tools: convertToolsToOllama(metadata?.tools),
			})

			const result = yield* processOllamaStream(stream, matcher)

			for (const chunk of matcher.final()) {
				yield chunk
			}

			for (const toolCallId of result.toolCallIds) {
				yield {
					type: "tool_call_end",
					id: toolCallId,
				}
			}

			if (result.totalInputTokens > 0 || result.totalOutputTokens > 0) {
				yield {
					type: "usage",
					inputTokens: result.totalInputTokens,
					outputTokens: result.totalOutputTokens,
				}
			}
		} catch (error) {
			handleOllamaError(error, this.options.ollamaBaseUrl, this.getModel().id)
		}
	}

	async fetchModel() {
		this.models = await getOllamaModels(this.options.ollamaBaseUrl, this.options.ollamaApiKey)
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.ollamaModelId || ""
		return {
			id: modelId,
			info: this.models[modelId] || openAiModelInfoSaneDefaults,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const client = this.ensureClient()
			const { id: modelId } = await this.fetchModel()
			const useR1Format = modelId.toLowerCase().includes("deepseek-r1")

			const chatOptions: OllamaChatOptions = {
				temperature: this.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
			}

			if (this.options.ollamaNumCtx !== undefined) {
				chatOptions.num_ctx = this.options.ollamaNumCtx
			}

			const response = await client.chat({
				model: modelId,
				messages: [{ role: "user", content: prompt }],
				stream: false,
				options: chatOptions,
			})

			return response.message?.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Ollama completion error: ${error.message}`)
			}
			throw error
		}
	}
}
