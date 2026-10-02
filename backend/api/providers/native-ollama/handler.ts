import { Anthropic } from "@anthropic-ai/sdk"
import { Ollama, type Config as OllamaOptions } from "ollama"
import { ModelInfo, openAiModelInfoSaneDefaults, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@jabberwock/types"
import { ApiStream } from "@api/transform/stream"
import { createBaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerOptions } from "@shared/api"
import { TagMatcher } from "@utils/text"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"

import { convertToOllamaMessages } from "./messages"
import { OllamaChatOptions } from "./types"
import { convertToolsToOllama, buildChatOptions, handleOllamaError } from "./utils"
import { processOllamaStream } from "./stream"
import { getOllamaModels } from "@api/providers/fetchers/providers/ollama"

export function NativeOllamaHandler(options: ApiHandlerOptions) {
	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		client: undefined as Ollama | undefined,
		models: {} as Record<string, ModelInfo>,
		ensureClient(): Ollama {
			if (!handler.client) {
				try {
					const clientOptions: OllamaOptions = {
						host: handler.options.ollamaBaseUrl || "http://localhost:11434",
					}
					if (handler.options.ollamaApiKey) {
						clientOptions.headers = {
							Authorization: `Bearer ${handler.options.ollamaApiKey}`,
						}
					}
					handler.client = new Ollama(clientOptions)
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					throw new Error(`Error creating Ollama client: ${message}`)
				}
			}
			return handler.client
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const client = handler.ensureClient()
			const { id: modelId } = await handler.fetchModel()
			const useR1Format = modelId.toLowerCase().includes("deepseek-r1")
			const ollamaMessages: import("ollama").Message[] = [
				{ role: "system", content: systemPrompt },
				...convertToOllamaMessages(messages),
			]
			const matcher = TagMatcher(
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
						ollamaNumCtx: handler.options.ollamaNumCtx,
						modelTemperature: handler.options.modelTemperature ?? undefined,
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
				handleOllamaError(error, handler.options.ollamaBaseUrl, handler.getModel().id)
			}
		},
		async fetchModel() {
			handler.models = await getOllamaModels(handler.options.ollamaBaseUrl, handler.options.ollamaApiKey)
			return handler.getModel()
		},
		getModel(): {
			id: string
			info: ModelInfo
		} {
			const modelId = handler.options.ollamaModelId || ""
			return {
				id: modelId,
				info: handler.models[modelId] || openAiModelInfoSaneDefaults,
			}
		},
		async completePrompt(prompt: string): Promise<string> {
			try {
				const client = handler.ensureClient()
				const { id: modelId } = await handler.fetchModel()
				const useR1Format = modelId.toLowerCase().includes("deepseek-r1")
				const chatOptions: OllamaChatOptions = {
					temperature: handler.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
				}
				if (handler.options.ollamaNumCtx !== undefined) {
					chatOptions.num_ctx = handler.options.ollamaNumCtx
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
		},
	}
	return handler
}
