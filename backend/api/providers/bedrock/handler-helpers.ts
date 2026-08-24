import { BedrockRuntimeClientConfig } from "@aws-sdk/client-bedrock-runtime"
import { fromIni } from "@aws-sdk/credential-providers"
import type { ModelInfo, ProviderSettings, BedrockModelId } from "@jabberwock/types"
import { BEDROCK_SERVICE_TIER_MODEL_IDS } from "@jabberwock/types"
import { logger } from "@utils/logging"
import { Package } from "@shared/package"
import { shouldUseReasoningBudget } from "@shared/api"
import type { ApiHandlerCreateMessageMetadata } from "@api/index"
import type { AnthropicReasoningParams } from "@api/transform/content/reasoning"
import { Anthropic } from "@anthropic-ai/sdk"
import { parseArn, parseBaseModelId, is1MContextModel } from "./core/models"

import { getModelParams } from "@api/transform/model-params"
import { BEDROCK_DEFAULT_TEMPERATURE } from "@jabberwock/types"
import {
	resolveModelFromArn,
	resolveModelFromDropdown,
	apply1MContextIfEnabled,
	applyServiceTierPricing,
} from "./core/resolve"

export function buildClientConfig(options: ProviderSettings): BedrockRuntimeClientConfig {
	const cfg: BedrockRuntimeClientConfig = {
		userAgentAppId: `Jabberwock#${Package.version}`,
		region: options.awsRegion,
	}
	if (options.awsBedrockEndpoint && options.awsBedrockEndpointEnabled) cfg.endpoint = options.awsBedrockEndpoint
	if (options.awsUseApiKey && options.awsApiKey) {
		cfg.token = { token: options.awsApiKey }
		cfg.authSchemePreference = ["httpBearerAuth"]
		cfg.requestHandler = { requestTimeout: 0 }
	} else if (options.awsUseProfile && options.awsProfile) {
		cfg.credentials = fromIni({ profile: options.awsProfile, ignoreCache: true })
	} else if (options.awsAccessKey && options.awsSecretKey) {
		cfg.credentials = {
			accessKeyId: options.awsAccessKey,
			secretAccessKey: options.awsSecretKey,
			...(options.awsSessionToken ? { sessionToken: options.awsSessionToken } : {}),
		}
	}
	return cfg
}

export function buildThinkingConfig(
	metadata:
		| (ApiHandlerCreateMessageMetadata & {
				thinking?: { enabled: boolean; maxTokens?: number; maxThinkingTokens?: number }
		  })
		| undefined,
	modelConfig: {
		id: BedrockModelId | string
		info: ModelInfo
		reasoning?: AnthropicReasoningParams
		reasoningBudget?: number
	},
	options: ProviderSettings,
): { enabled: boolean; budgetTokens: number } {
	const explicit = metadata?.thinking?.enabled
	const hasReasoningSettings = shouldUseReasoningBudget({ model: modelConfig.info, settings: options })
	const hasReasoningConfig = Boolean(modelConfig.reasoning) && Boolean(modelConfig.reasoningBudget)
	const bySettings = hasReasoningSettings && hasReasoningConfig
	const supportsReasoning = modelConfig.info.supportsReasoningBudget ?? false
	const enabled = (explicit !== undefined ? explicit : bySettings) && supportsReasoning
	const budgetTokens = enabled ? resolveThinkingBudget(metadata, modelConfig) : 0
	return { enabled, budgetTokens }
}

export function resolveThinkingBudget(
	metadata:
		| (ApiHandlerCreateMessageMetadata & {
				thinking?: { enabled: boolean; maxTokens?: number; maxThinkingTokens?: number }
		  })
		| undefined,
	modelConfig: { reasoningBudget?: number },
): number {
	return metadata?.thinking?.maxThinkingTokens || modelConfig.reasoningBudget || 4096
}

export function buildAnthropicBetas(
	modelConfig: { id: BedrockModelId | string; info: ModelInfo },
	options: ProviderSettings,
): string[] {
	const betas: string[] = []
	const baseId = parseBaseModelId(modelConfig.id)
	if (is1MContextModel(baseId) && options.awsBedrock1MContext) betas.push("context-1m-2025-08-07")
	if (baseId.includes("claude")) betas.push("fine-grained-tool-streaming-2025-05-14")
	return betas
}

export function buildConversationId(messages: Anthropic.Messages.MessageParam[]): string {
	return messages.length > 0
		? `conv_${messages[0].role}_${typeof messages[0].content === "string" ? messages[0].content.substring(0, 20) : "complex_content"}`
		: "default_conversation"
}

export function isServiceTierSupported(
	modelConfig: { id: BedrockModelId | string; info: ModelInfo },
	options: ProviderSettings,
): { useServiceTier: boolean; baseModelId: string } {
	const baseModelId = parseBaseModelId(modelConfig.id)
	const useServiceTier = !!(
		options.awsBedrockServiceTier &&
		BEDROCK_SERVICE_TIER_MODEL_IDS.includes(baseModelId as (typeof BEDROCK_SERVICE_TIER_MODEL_IDS)[number])
	)
	if (useServiceTier)
		logger.info("Service tier specified for Bedrock request", {
			ctx: "bedrock",
			modelId: modelConfig.id,
			serviceTier: options.awsBedrockServiceTier,
		})
	return { useServiceTier, baseModelId }
}

export function resolveModelConfig(
	options: ProviderSettings,
	costModelConfig: { id: BedrockModelId | string; info: ModelInfo } | undefined,
	arnInfo?: ReturnType<typeof parseArn> & { awsUseCrossRegionInference?: boolean },
): {
	id: BedrockModelId | string
	info: ModelInfo
	maxTokens?: number
	temperature?: number
	reasoning?: AnthropicReasoningParams
	reasoningBudget?: number
} {
	if (costModelConfig && costModelConfig.id.trim().length > 0) {
		return {
			...costModelConfig,
			...getModelParams({
				format: "anthropic",
				modelId: costModelConfig.id,
				model: costModelConfig.info,
				settings: options,
				defaultTemperature: BEDROCK_DEFAULT_TEMPERATURE,
			}),
		}
	}
	const modelConfig =
		options.awsCustomArn && arnInfo ? resolveModelFromArn(arnInfo, options) : resolveModelFromDropdown(options)
	const updatedConfig = apply1MContextIfEnabled(modelConfig, options)
	applyServiceTierPricing(updatedConfig, options)
	return {
		...updatedConfig,
		...getModelParams({
			format: "anthropic",
			modelId: updatedConfig.id,
			model: updatedConfig.info,
			settings: options,
			defaultTemperature: BEDROCK_DEFAULT_TEMPERATURE,
		}),
	} as {
		id: BedrockModelId | string
		info: ModelInfo
		maxTokens?: number
		temperature?: number
		reasoning?: AnthropicReasoningParams
		reasoningBudget?: number
	}
}
