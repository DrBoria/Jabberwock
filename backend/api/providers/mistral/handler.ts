import { Anthropic } from "@anthropic-ai/sdk"
import { Mistral } from "@mistralai/mistralai"
import OpenAI from "openai"

import {
	type MistralModelId,
	mistralDefaultModelId,
	mistralModels,
	MISTRAL_DEFAULT_TEMPERATURE,
	ApiProviderError,
} from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"

import { ApiHandlerOptions } from "@shared/api"

import { convertToMistralMessages } from "@api/transform/format/mistral-format"
import { ApiStream } from "@api/transform/stream"

import { createBaseProvider } from "@api/providers/base-provider"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"

import { processMistralEvent } from "./stream"
import { MistralTool } from "./types"

export function MistralHandler(options: ApiHandlerOptions) {
	let providerName = "Mistral"
	if (!options.mistralApiKey) {
		throw new Error("Mistral API key is required")
	}

	const apiModelId = options.apiModelId || mistralDefaultModelId
	options = { ...options, apiModelId }

	const client = new Mistral({
		serverURL: apiModelId.startsWith("codestral-")
			? options.mistralCodestralUrl || "https://codestral.mistral.ai"
			: "https://api.mistral.ai",
		apiKey: options.mistralApiKey,
	})

	const base = createBaseProvider()
	const handler = {
		...base,
		options: options,
		client: client,
		providerName: providerName,
		handleMistralError(error: unknown, model: string, method: string): never {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const apiError = new ApiProviderError(errorMessage, handler.providerName, model, method)
			getTelemetryService().captureException(apiError)
			throw new Error(`Mistral completion error: ${errorMessage}`)
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata,
		): ApiStream {
			const { id: model, info, maxTokens, temperature } = handler.getModel()
			const tools = handler.convertToolsForMistral(metadata?.tools ?? [])
			const requestOptions = {
				model,
				messages: [{ role: "system" as const, content: systemPrompt }, ...convertToMistralMessages(messages)],
				maxTokens: maxTokens ?? info.maxTokens,
				temperature,
				tools,
				toolChoice: "any" as const,
			}
			let response: Awaited<ReturnType<typeof handler.client.chat.stream>> | undefined
			try {
				response = await handler.client.chat.stream(requestOptions)
			} catch (error) {
				handler.handleMistralError(error, model, "createMessage")
			}
			if (!response) throw new Error("stream creation failed")
			for await (const event of response) {
				const { choices, usage } = event.data
				yield* processMistralEvent(choices, usage)
			}
		},
		convertToolsForMistral(tools: OpenAI.Chat.ChatCompletionTool[]): MistralTool[] {
			return tools
				.filter((tool) => tool.type === "function")
				.map((tool) => ({
					type: "function" as const,
					function: {
						name: tool.function.name,
						description: tool.function.description,
						parameters: (tool.function.parameters as Record<string, unknown>) || {},
					},
				}))
		},
		getModel() {
			const id = handler.options.apiModelId ?? mistralDefaultModelId
			const info = mistralModels[id as MistralModelId] ?? mistralModels[mistralDefaultModelId]
			const maxTokens = handler.options.includeMaxTokens ? info.maxTokens : undefined
			const temperature = handler.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE
			return { id, info, maxTokens, temperature }
		},
		async completePrompt(prompt: string): Promise<string> {
			const { id: model, temperature } = handler.getModel()
			try {
				const response = await handler.client.chat.complete({
					model,
					messages: [{ role: "user", content: prompt }],
					temperature,
				})
				const content = response.choices?.[0]?.message.content
				if (Array.isArray(content)) {
					const textParts: string[] = []
					for (const c of content) {
						if (c.type === "text" && "text" in c && c.text) {
							textParts.push(c.text)
						}
					}
					return textParts.join("")
				}
				return content || ""
			} catch (error) {
				handler.handleMistralError(error, model, "completePrompt")
				throw error
			}
		},
	}
	return handler
}
