import {
	BedrockRuntimeClient,
	ConverseStreamCommand,
	ConverseCommand,
	BedrockRuntimeClientConfig,
	SystemContentBlock,
	Message,
} from "@aws-sdk/client-bedrock-runtime"
import { Anthropic } from "@anthropic-ai/sdk"
import type { ModelInfo, ProviderSettings, BedrockModelId } from "@jabberwock/types"
import { BEDROCK_DEFAULT_TEMPERATURE } from "@jabberwock/types"
import { ApiStream } from "@api/transform/stream"
import { BaseProvider } from "@api/providers/base-provider"
import { logger } from "@utils/logging"
import { getModelParams } from "@api/transform/model-params"
import type { AnthropicReasoningParams } from "@api/transform/content/reasoning"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "@api/index"
import type { BedrockPayloadWithServiceTier } from "./core/types"
import { tryParseStreamEvent, handleStreamEvent, type StreamHandlerContext } from "./stream"
import { handleCreateMessageError, type ErrorHandlerContext } from "./errors"
import { completePrompt } from "./core/complete"
import { parseArn, parseBaseModelId, getModelById } from "./core/models"
import { buildCreateMessagePayload } from "./core/payload"
import { convertToBedrockConverseMessages, supportsAwsPromptCache } from "./core/cache"
import type { CachePointPlacement } from "@api/transform/cache-strategy/types"
import {
	resolveModelFromArn,
	resolveModelFromDropdown,
	apply1MContextIfEnabled,
	applyServiceTierPricing,
} from "./core/resolve"
import {
	buildClientConfig,
	buildThinkingConfig,
	resolveThinkingBudget,
	buildAnthropicBetas,
	buildConversationId,
	isServiceTierSupported,
	resolveModelConfig,
} from "./handler-helpers"

import type OpenAI from "openai"

export class AwsBedrockHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ProviderSettings
	private client: BedrockRuntimeClient
	private arnInfo!: ReturnType<typeof parseArn> & { awsUseCrossRegionInference?: boolean }
	private readonly providerName = "Bedrock"
	private costModelConfig: { id: BedrockModelId | string; info: ModelInfo } = {
		id: "",
		info: { maxTokens: 0, contextWindow: 0, supportsPromptCache: false, supportsImages: false },
	}

	constructor(options: ProviderSettings) {
		super()
		this.options = options
		if (this.options.awsCustomArn) this.processArn()
		if (!this.options.modelTemperature) this.options.modelTemperature = BEDROCK_DEFAULT_TEMPERATURE
		this.costModelConfig = this.getModel()
		this.client = new BedrockRuntimeClient(buildClientConfig(this.options))
	}

	private processArn(): void {
		this.arnInfo = parseArn(this.options.awsCustomArn!, this.options.awsRegion)
		if (!this.arnInfo.isValid) {
			logger.error("Invalid ARN format", { ctx: "bedrock", errorMessage: this.arnInfo.errorMessage })
			throw new Error("INVALID_ARN_FORMAT:" + (this.arnInfo.errorMessage ?? "Invalid ARN format"))
		}
		if (this.arnInfo.region && this.arnInfo.region !== this.options.awsRegion) {
			logger.info(this.arnInfo.errorMessage ?? "", {
				ctx: "bedrock",
				selectedRegion: this.options.awsRegion,
				arnRegion: this.arnInfo.region,
			})
			this.options.awsRegion = this.arnInfo.region
		}
		this.options.apiModelId = this.arnInfo.modelId
		if (this.arnInfo.awsUseCrossRegionInference) this.options.awsUseCrossRegionInference = true
	}

	override getModel(): {
		id: BedrockModelId | string
		info: ModelInfo
		maxTokens?: number
		temperature?: number
		reasoning?: AnthropicReasoningParams
		reasoningBudget?: number
	} {
		return resolveModelConfig(this.options, this.costModelConfig, this.arnInfo)
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata & {
			thinking?: { enabled: boolean; maxTokens?: number; maxThinkingTokens?: number }
		},
	): ApiStream {
		const modelConfig = this.getModel()
		const conversationId = buildConversationId(messages)
		const useCache = Boolean((this.options.awsUsePromptCache ?? true) && supportsAwsPromptCache(modelConfig))
		const formatted = convertToBedrockConverseMessages(
			messages,
			systemPrompt,
			useCache,
			modelConfig.info,
			conversationId,
			this.previousCachePointPlacements,
		)
		const thinkingConfig = buildThinkingConfig(metadata, modelConfig, this.options)

		const payload = this.buildCreateMessagePayload(
			modelConfig,
			metadata,
			thinkingConfig,
			formatted,
			metadata?.tools ?? [],
			metadata?.tool_choice,
		)

		const controller = new AbortController()
		let timeoutId: NodeJS.Timeout | undefined
		const streamContext: StreamHandlerContext = {
			parseArn: (a, r) => {
				const result = parseArn(a, r)
				return { ...result, crossRegionInference: result.awsUseCrossRegionInference ?? false }
			},
			getModelById: (id, type) => getModelById(id, type, this.options),
			setCostModelConfig: (c) => {
				this.costModelConfig = c
			},
		}
		const errorCtx: ErrorHandlerContext = {
			providerName: this.providerName,
			options: this.options,
			clientRegion: () => {
				const r = this.client?.config?.region
				return typeof r === "function" ? String(r()) : (r ?? "")
			},
			getModel: () => this.getModel(),
		}

		try {
			timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000)
			const response = await this.client.send(
				new ConverseStreamCommand(payload as ConstructorParameters<typeof ConverseStreamCommand>[0]),
				{ abortSignal: controller.signal },
			)
			if (!response.stream) {
				clearTimeout(timeoutId)
				throw new Error("No stream available in the response")
			}
			for await (const chunk of response.stream) {
				const streamEvent = tryParseStreamEvent(chunk)
				if (streamEvent) yield* handleStreamEvent(streamEvent, modelConfig, streamContext)
			}
			clearTimeout(timeoutId)
		} catch (error: unknown) {
			clearTimeout(timeoutId)
			yield* handleCreateMessageError(error, modelConfig, errorCtx)
		}
	}

	private buildCreateMessagePayload(
		modelConfig: {
			id: BedrockModelId | string
			info: ModelInfo
			maxTokens?: number
			temperature?: number
			reasoning?: AnthropicReasoningParams
			reasoningBudget?: number
		},
		metadata:
			| (ApiHandlerCreateMessageMetadata & {
					thinking?: { enabled: boolean; maxTokens?: number; maxThinkingTokens?: number }
			  })
			| undefined,
		thinkingConfig: { enabled: boolean; budgetTokens: number },
		formatted: { messages: Message[]; system: SystemContentBlock[] },
		tools: OpenAI.Chat.ChatCompletionTool[],
		toolChoice: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"] | undefined,
	): BedrockPayloadWithServiceTier {
		return buildCreateMessagePayload(modelConfig, metadata, thinkingConfig, formatted, tools, toolChoice, {
			buildAnthropicBetas: (mc) => buildAnthropicBetas(mc, this.options),
			isServiceTierSupported: (mc) => isServiceTierSupported(mc, this.options),
			awsBedrockServiceTier: this.options.awsBedrockServiceTier,
			modelTemperature: this.options.modelTemperature ?? undefined,
		})
	}

	async completePrompt(prompt: string): Promise<string> {
		const errorCtx: ErrorHandlerContext = {
			providerName: this.providerName,
			options: this.options,
			clientRegion: () => {
				const r = this.client?.config?.region
				return typeof r === "function" ? String(r()) : (r ?? "")
			},
			getModel: () => this.getModel(),
		}
		return completePrompt(prompt, this.client, () => this.getModel(), errorCtx)
	}

	private previousCachePointPlacements: Record<string, CachePointPlacement[]> = {}
}
