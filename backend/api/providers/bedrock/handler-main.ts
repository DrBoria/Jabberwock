import {
	BedrockRuntimeClient,
	ConverseStreamCommand,
	SystemContentBlock,
	Message,
} from "@aws-sdk/client-bedrock-runtime"
import { Anthropic } from "@anthropic-ai/sdk"
import type { ModelInfo, ProviderSettings, BedrockModelId } from "@jabberwock/types"
import { BEDROCK_DEFAULT_TEMPERATURE } from "@jabberwock/types"
import { ApiStream } from "@api/transform/stream"
import { createBaseProvider } from "@api/providers/base-provider"
import { logger } from "@utils/logging"
import type { AnthropicReasoningParams } from "@api/transform/content/reasoning"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import type { BedrockPayloadWithServiceTier } from "./core/types"
import { tryParseStreamEvent, handleStreamEvent, type StreamHandlerContext } from "./stream"
import { handleCreateMessageError, type ErrorHandlerContext } from "./errors"
import { completePrompt } from "./core/complete"
import { parseArn, getModelById } from "./core/models"
import { buildCreateMessagePayload } from "./core/payload"
import { convertToBedrockConverseMessages, supportsAwsPromptCache } from "./core/cache"
import type { CachePointPlacement } from "@api/transform/cache-strategy/types"
import {
	buildClientConfig,
	buildThinkingConfig,
	buildAnthropicBetas,
	buildConversationId,
	isServiceTierSupported,
	resolveModelConfig,
} from "./handler-helpers"

import type OpenAI from "openai"

export function AwsBedrockHandler(options: ProviderSettings) {
	let providerName = "Bedrock"
	let previousCachePointPlacements: Record<string, CachePointPlacement[]> = {}
	let arnInfo: (ReturnType<typeof parseArn> & { awsUseCrossRegionInference?: boolean }) | undefined = undefined
	const processArn = (): void => {
		arnInfo = parseArn(options.awsCustomArn!, options.awsRegion)
		if (!arnInfo.isValid) {
			logger.error("Invalid ARN format", { ctx: "bedrock", errorMessage: arnInfo.errorMessage })
			throw new Error("INVALID_ARN_FORMAT:" + (arnInfo.errorMessage ?? "Invalid ARN format"))
		}
		if (arnInfo.region && arnInfo.region !== options.awsRegion) {
			logger.info(arnInfo.errorMessage ?? "", {
				ctx: "bedrock",
				selectedRegion: options.awsRegion,
				arnRegion: arnInfo.region,
			})
			options.awsRegion = arnInfo.region
		}
		options.apiModelId = arnInfo.modelId
		if (arnInfo.awsUseCrossRegionInference) options.awsUseCrossRegionInference = true
	}
	if (options.awsCustomArn) processArn()
	if (!options.modelTemperature) options.modelTemperature = BEDROCK_DEFAULT_TEMPERATURE
	const client = new BedrockRuntimeClient(buildClientConfig(options))
	const base = createBaseProvider()
	const handler = {
		...base,
		options,
		client: client,
		arnInfo: arnInfo,
		providerName: providerName,
		costModelConfig: {
			id: "",
			info: { maxTokens: 0, contextWindow: 0, supportsPromptCache: false, supportsImages: false },
		} as {
			id: BedrockModelId | string
			info: ModelInfo
		},
		previousCachePointPlacements: previousCachePointPlacements,
		getModel(): {
			id: BedrockModelId | string
			info: ModelInfo
			maxTokens?: number
			temperature?: number
			reasoning?: AnthropicReasoningParams
			reasoningBudget?: number
		} {
			return resolveModelConfig(handler.options, handler.costModelConfig, handler.arnInfo)
		},
		async *createMessage(
			systemPrompt: string,
			messages: Anthropic.Messages.MessageParam[],
			metadata?: ApiHandlerCreateMessageMetadata & {
				thinking?: {
					enabled: boolean
					maxTokens?: number
					maxThinkingTokens?: number
				}
			},
		): ApiStream {
			const modelConfig = handler.getModel()
			const conversationId = buildConversationId(messages)
			const useCache = Boolean((handler.options.awsUsePromptCache ?? true) && supportsAwsPromptCache(modelConfig))
			const formatted = convertToBedrockConverseMessages(
				messages,
				systemPrompt,
				useCache,
				modelConfig.info,
				conversationId,
				handler.previousCachePointPlacements,
			)
			const thinkingConfig = buildThinkingConfig(metadata, modelConfig, handler.options)
			const payload = handler.buildCreateMessagePayload(
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
				getModelById: (id, type) => getModelById(id, type, handler.options),
				setCostModelConfig: (c) => {
					handler.costModelConfig = c
				},
			}
			const errorCtx: ErrorHandlerContext = {
				providerName: handler.providerName,
				options: handler.options,
				clientRegion: () => {
					const r = handler.client?.config?.region
					return typeof r === "function" ? String(r()) : (r ?? "")
				},
				getModel: () => handler.getModel(),
			}
			try {
				timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000)
				const response = await handler.client.send(
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
		},
		buildCreateMessagePayload(
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
						thinking?: {
							enabled: boolean
							maxTokens?: number
							maxThinkingTokens?: number
						}
				  })
				| undefined,
			thinkingConfig: {
				enabled: boolean
				budgetTokens: number
			},
			formatted: {
				messages: Message[]
				system: SystemContentBlock[]
			},
			tools: OpenAI.Chat.ChatCompletionTool[],
			toolChoice: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"] | undefined,
		): BedrockPayloadWithServiceTier {
			return buildCreateMessagePayload(modelConfig, metadata, thinkingConfig, formatted, tools, toolChoice, {
				buildAnthropicBetas: (mc) => buildAnthropicBetas(mc, handler.options),
				isServiceTierSupported: (mc) => isServiceTierSupported(mc, handler.options),
				awsBedrockServiceTier: handler.options.awsBedrockServiceTier,
				modelTemperature: handler.options.modelTemperature ?? undefined,
			})
		},
		async completePrompt(prompt: string): Promise<string> {
			const errorCtx: ErrorHandlerContext = {
				providerName: handler.providerName,
				options: handler.options,
				clientRegion: () => {
					const r = handler.client?.config?.region
					return typeof r === "function" ? String(r()) : (r ?? "")
				},
				getModel: () => handler.getModel(),
			}
			return completePrompt(prompt, handler.client, () => handler.getModel(), errorCtx)
		},
	}
	handler.costModelConfig = handler.getModel()
	return handler
}
