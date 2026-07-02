import type { ProviderSettings, ModelInfo, BedrockModelId, BedrockServiceTier } from "@jabberwock/types"
import type { AnthropicReasoningParams } from "@api/transform/content/reasoning"
import type OpenAI from "openai"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import { logger } from "@utils/logging"
import { SystemContentBlock, Message, ToolConfiguration } from "@aws-sdk/client-bedrock-runtime"
import { convertToolsForBedrock, convertToolChoiceForBedrock } from "./tools"
import type { BedrockInferenceConfig, BedrockPayloadWithServiceTier, BedrockAdditionalModelFields } from "./types"

interface BuildPayloadContext {
	buildAnthropicBetas(modelConfig: { id: BedrockModelId | string; info: ModelInfo }): string[]
	isServiceTierSupported(modelConfig: { id: BedrockModelId | string; info: ModelInfo }): {
		useServiceTier: boolean
		baseModelId: string
	}
	awsBedrockServiceTier?: BedrockServiceTier
	modelTemperature?: number
}

export function buildCreateMessagePayload(
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
	ctx: BuildPayloadContext,
): BedrockPayloadWithServiceTier {
	let additionalModelRequestFields: BedrockAdditionalModelFields | undefined
	if (thinkingConfig.enabled) {
		additionalModelRequestFields = { thinking: { type: "enabled", budget_tokens: thinkingConfig.budgetTokens } }
		logger.info("Extended thinking enabled for Bedrock request", {
			ctx: "bedrock",
			thinking: additionalModelRequestFields.thinking,
		})
	}
	const anthropicBetas = ctx.buildAnthropicBetas(modelConfig)
	if (anthropicBetas.length > 0) {
		if (!additionalModelRequestFields) additionalModelRequestFields = {} as BedrockAdditionalModelFields
		additionalModelRequestFields.anthropic_beta = anthropicBetas
	}

	const inferenceConfig: BedrockInferenceConfig = {
		maxTokens: modelConfig.maxTokens || (modelConfig.info.maxTokens as number),
		temperature: modelConfig.temperature ?? (ctx.modelTemperature as number),
	}
	const { useServiceTier } = ctx.isServiceTierSupported(modelConfig)
	const toolConfig: ToolConfiguration = {
		tools: convertToolsForBedrock(tools),
		toolChoice: convertToolChoiceForBedrock(toolChoice),
	}
	return {
		modelId: modelConfig.id,
		messages: formatted.messages,
		system: formatted.system,
		inferenceConfig,
		...(additionalModelRequestFields && { additionalModelRequestFields }),
		...(thinkingConfig.enabled && { anthropic_version: "bedrock-2023-05-31" }),
		toolConfig,
		...(useServiceTier && { service_tier: ctx.awsBedrockServiceTier }),
	}
}
