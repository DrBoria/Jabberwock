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

import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"

import { processMistralEvent } from "./stream"
import { MistralTool } from "./types"

export class MistralHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: Mistral
	private readonly providerName = "Mistral"

	constructor(options: ApiHandlerOptions) {
		super()

		if (!options.mistralApiKey) {
			throw new Error("Mistral API key is required")
		}

		const apiModelId = options.apiModelId || mistralDefaultModelId
		this.options = { ...options, apiModelId }

		this.client = new Mistral({
			serverURL: apiModelId.startsWith("codestral-")
				? this.options.mistralCodestralUrl || "https://codestral.mistral.ai"
				: "https://api.mistral.ai",
			apiKey: this.options.mistralApiKey,
		})
	}

	private handleMistralError(error: unknown, model: string, method: string): never {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const apiError = new ApiProviderError(errorMessage, this.providerName, model, method)
		getTelemetryService().captureException(apiError)
		throw new Error(`Mistral completion error: ${errorMessage}`)
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: model, info, maxTokens, temperature } = this.getModel()
		const tools = this.convertToolsForMistral(metadata?.tools ?? [])

		const requestOptions = {
			model,
			messages: [{ role: "system" as const, content: systemPrompt }, ...convertToMistralMessages(messages)],
			maxTokens: maxTokens ?? info.maxTokens,
			temperature,
			tools,
			toolChoice: "any" as const,
		}

		let response
		try {
			response = await this.client.chat.stream(requestOptions)
		} catch (error) {
			this.handleMistralError(error, model, "createMessage")
		}

		for await (const event of response) {
			const { choices, usage } = event.data
			yield* processMistralEvent(choices, usage)
		}
	}

	/**
	 * Convert OpenAI tool definitions to Mistral format.
	 * Mistral uses the same format as OpenAI for function tools.
	 */
	private convertToolsForMistral(tools: OpenAI.Chat.ChatCompletionTool[]): MistralTool[] {
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
	}

	override getModel() {
		const id = this.options.apiModelId ?? mistralDefaultModelId
		const info = mistralModels[id as MistralModelId] ?? mistralModels[mistralDefaultModelId]

		const maxTokens = this.options.includeMaxTokens ? info.maxTokens : undefined
		const temperature = this.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE

		return { id, info, maxTokens, temperature }
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: model, temperature } = this.getModel()

		try {
			const response = await this.client.chat.complete({
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
			this.handleMistralError(error, model, "completePrompt")
		}
	}
}
