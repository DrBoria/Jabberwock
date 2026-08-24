import type { ModelInfo, BedrockModelId, ProviderSettings } from "@jabberwock/types"
import {
	BEDROCK_GLOBAL_INFERENCE_MODEL_IDS,
	BEDROCK_SERVICE_TIER_MODEL_IDS,
	BEDROCK_SERVICE_TIER_PRICING,
} from "@jabberwock/types"
import { getModelById, parseBaseModelId, getPrefixForRegion, is1MContextModel } from "./models"

export function resolveModelFromArn(
	arnInfo: { modelId?: string; modelType?: string },
	options: ProviderSettings,
): { id: BedrockModelId | string; info: ModelInfo } {
	const modelConfig = getModelById(arnInfo.modelId ?? "", arnInfo.modelType, options)
	if (arnInfo.modelType !== "foundation-model") modelConfig.id = options.awsCustomArn!
	return modelConfig
}

export function resolveModelFromDropdown(options: ProviderSettings): { id: BedrockModelId | string; info: ModelInfo } {
	const modelConfig = getModelById(options.apiModelId as string, undefined, options)
	const baseIdForGlobal = parseBaseModelId(modelConfig.id)

	if (
		options.awsUseGlobalInference &&
		BEDROCK_GLOBAL_INFERENCE_MODEL_IDS.includes(
			baseIdForGlobal as (typeof BEDROCK_GLOBAL_INFERENCE_MODEL_IDS)[number],
		)
	) {
		modelConfig.id = `global.${baseIdForGlobal}`
	} else if (options.awsUseCrossRegionInference && options.awsRegion) {
		const prefix = getPrefixForRegion(options.awsRegion)
		if (prefix) modelConfig.id = `${prefix}${modelConfig.id}`
	}

	return modelConfig
}

export function apply1MContextModelConfig(modelConfig: { id: BedrockModelId | string; info: ModelInfo }): void {
	const tier = modelConfig.info.tiers?.[0]
	if (!tier) return
	modelConfig.info = {
		...modelConfig.info,
		contextWindow: tier.contextWindow ?? 1_000_000,
		inputPrice: tier.inputPrice ?? modelConfig.info.inputPrice,
		outputPrice: tier.outputPrice ?? modelConfig.info.outputPrice,
		cacheWritesPrice: tier.cacheWritesPrice ?? modelConfig.info.cacheWritesPrice,
		cacheReadsPrice: tier.cacheReadsPrice ?? modelConfig.info.cacheReadsPrice,
	}
}

export function apply1MContextIfEnabled(
	modelConfig: { id: BedrockModelId | string; info: ModelInfo },
	options: ProviderSettings,
): { id: BedrockModelId | string; info: ModelInfo } {
	const baseModelId = parseBaseModelId(modelConfig.id)
	if (is1MContextModel(baseModelId) && options.awsBedrock1MContext) {
		apply1MContextModelConfig(modelConfig)
	}
	return modelConfig
}

export function applyServiceTierPricing(
	modelConfig: { id: BedrockModelId | string; info: ModelInfo },
	options: ProviderSettings,
): void {
	const baseModelIdForTier = parseBaseModelId(modelConfig.id)
	if (
		!options.awsBedrockServiceTier ||
		!BEDROCK_SERVICE_TIER_MODEL_IDS.includes(baseModelIdForTier as (typeof BEDROCK_SERVICE_TIER_MODEL_IDS)[number])
	)
		return

	const pricingMultiplier = BEDROCK_SERVICE_TIER_PRICING[options.awsBedrockServiceTier]
	if (!pricingMultiplier || pricingMultiplier === 1.0) return

	modelConfig.info = {
		...modelConfig.info,
		inputPrice: modelConfig.info.inputPrice ? modelConfig.info.inputPrice * pricingMultiplier : undefined,
		outputPrice: modelConfig.info.outputPrice ? modelConfig.info.outputPrice * pricingMultiplier : undefined,
		cacheWritesPrice: modelConfig.info.cacheWritesPrice
			? modelConfig.info.cacheWritesPrice * pricingMultiplier
			: undefined,
		cacheReadsPrice: modelConfig.info.cacheReadsPrice
			? modelConfig.info.cacheReadsPrice * pricingMultiplier
			: undefined,
	}
}
