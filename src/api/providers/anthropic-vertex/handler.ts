import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { GoogleAuth, JWTInput } from "google-auth-library"

import {
	type ModelInfo,
	type VertexModelId,
	vertexDefaultModelId,
	vertexModels,
	VERTEX_1M_CONTEXT_MODEL_IDS,
} from "@jabberwock/types"
import { safeJsonParse } from "@jabberwock/core"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "@jabberwock/types"

import { ApiHandlerOptions } from "@shared/api"

import { getModelParams } from "@api/transform/model-params"
import { filterNonAnthropicBlocks } from "@api/transform/format/anthropic-filter"
import {
	convertOpenAIToolsToAnthropic,
	convertOpenAIToolChoiceToAnthropic,
} from "@features/settings/context/tools/native-tools/converters"

import { BaseProvider } from "@api/providers/base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import type { ApiStream } from "@api/transform/stream"
import { buildVertexRequestParams, buildVertexRequestOptions, processVertexStream } from "./helpers"

// https://docs.anthropic.com/en/api/claude-on-vertex-ai
/**
 * Content block types for Anthropic Vertex extended thinking.
 * The Anthropic Vertex SDK includes "thinking" and "thinking_delta" event types
 * that are not part of the base Anthropic ContentBlockParam union.
 */

export class AnthropicVertexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: AnthropicVertex

	constructor(options: ApiHandlerOptions) {
		super()

		this.options = options

		// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
		const projectId = this.options.vertexProjectId ?? "not-provided"
		const region = this.options.vertexRegion ?? "us-east5"

		if (this.options.vertexJsonCredentials) {
			this.client = new AnthropicVertex({
				projectId,
				region,
				googleAuth: new GoogleAuth({
					scopes: ["https://www.googleapis.com/auth/cloud-platform"],
					credentials: safeJsonParse<JWTInput>(this.options.vertexJsonCredentials, undefined),
				}),
			})
		} else if (this.options.vertexKeyFile) {
			this.client = new AnthropicVertex({
				projectId,
				region,
				googleAuth: new GoogleAuth({
					scopes: ["https://www.googleapis.com/auth/cloud-platform"],
					keyFile: this.options.vertexKeyFile,
				}),
			})
		} else {
			this.client = new AnthropicVertex({ projectId, region })
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id, info, temperature, maxTokens, reasoning: thinking, betas } = this.getModel()

		const { supportsPromptCache } = info

		const sanitizedMessages = filterNonAnthropicBlocks(messages)

		const nativeToolParams = {
			tools: convertOpenAIToolsToAnthropic(metadata?.tools ?? []),
			tool_choice: convertOpenAIToolChoiceToAnthropic(metadata?.tool_choice, metadata?.parallelToolCalls),
		}

		const params = buildVertexRequestParams(
			id,
			maxTokens,
			temperature,
			thinking,
			systemPrompt,
			supportsPromptCache,
			sanitizedMessages,
			nativeToolParams,
		)

		const requestOptions = buildVertexRequestOptions(betas)

		const stream = await this.client.messages.create(params, requestOptions)

		yield* processVertexStream(stream)
	}

	getModel() {
		const modelId = this.options.apiModelId
		const id = modelId && modelId in vertexModels ? (modelId as VertexModelId) : vertexDefaultModelId
		let info: ModelInfo = vertexModels[id]

		// Check if 1M context beta should be enabled for supported models
		const supports1MContext = VERTEX_1M_CONTEXT_MODEL_IDS.includes(
			id as (typeof VERTEX_1M_CONTEXT_MODEL_IDS)[number],
		)
		const enable1MContext = supports1MContext && this.options.vertex1MContext

		// If 1M context beta is enabled, update the model info with tier pricing
		if (enable1MContext) {
			const tier = info.tiers?.[0]
			if (tier) {
				info = {
					...info,
					contextWindow: tier.contextWindow,
					inputPrice: tier.inputPrice,
					outputPrice: tier.outputPrice,
					cacheWritesPrice: tier.cacheWritesPrice,
					cacheReadsPrice: tier.cacheReadsPrice,
				}
			}
		}

		const params = getModelParams({
			format: "anthropic",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: 0,
		})

		// Build betas array for request headers
		const betas: string[] = []

		// Add 1M context beta flag if enabled for supported models
		if (enable1MContext) {
			betas.push("context-1m-2025-08-07")
		}

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Anthropic's API does not have this
		// suffix.
		return {
			id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id,
			info,
			betas: betas.length > 0 ? betas : undefined,
			...params,
		}
	}

	async completePrompt(prompt: string) {
		try {
			const {
				id,
				info: { supportsPromptCache },
				temperature,
				maxTokens = ANTHROPIC_DEFAULT_MAX_TOKENS,
				reasoning: thinking,
			} = this.getModel()

			const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
				model: id,
				max_tokens: maxTokens,
				temperature,
				thinking,
				messages: [
					{
						role: "user",
						content: supportsPromptCache
							? [{ type: "text" as const, text: prompt, cache_control: { type: "ephemeral" } }]
							: prompt,
					},
				],
				stream: false,
			}

			const response = await this.client.messages.create(params)
			const content = response.content[0]

			if (content.type === "text") {
				return content.text
			}

			return ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Vertex completion error: ${error.message}`)
			}

			throw error
		}
	}
}
