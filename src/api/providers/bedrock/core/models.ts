import type { ModelInfo, BedrockModelId } from "@jabberwock/types"
import {
	bedrockModels,
	BEDROCK_MAX_TOKENS,
	BEDROCK_DEFAULT_CONTEXT,
	AWS_INFERENCE_PROFILE_MAPPING,
	BEDROCK_1M_CONTEXT_MODEL_IDS,
} from "@jabberwock/types"

export function guessModelInfoFromId(modelId: string): Partial<ModelInfo> {
	const modelConfigMap: Record<string, Partial<ModelInfo>> = {
		"claude-4": {
			maxTokens: 8192,
			contextWindow: 200_000,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"claude-3-7": {
			maxTokens: 8192,
			contextWindow: 200_000,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"claude-3-5": {
			maxTokens: 8192,
			contextWindow: 200_000,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"claude-4-opus": {
			maxTokens: 4096,
			contextWindow: 200_000,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"claude-3-opus": {
			maxTokens: 4096,
			contextWindow: 200_000,
			supportsImages: true,
			supportsPromptCache: true,
		},
		"claude-3-haiku": {
			maxTokens: 4096,
			contextWindow: 200_000,
			supportsImages: true,
			supportsPromptCache: true,
		},
	}

	const id = modelId.toLowerCase()
	for (const [pattern, config] of Object.entries(modelConfigMap)) {
		if (id.includes(pattern)) {
			return config
		}
	}

	return {
		maxTokens: BEDROCK_MAX_TOKENS,
		contextWindow: BEDROCK_DEFAULT_CONTEXT,
		supportsImages: false,
		supportsPromptCache: false,
	}
}

export function parseBaseModelId(modelId: string): string {
	if (!modelId) {
		return modelId
	}

	for (const [_, inferenceProfile] of AWS_INFERENCE_PROFILE_MAPPING) {
		if (modelId.startsWith(inferenceProfile)) {
			return modelId.substring(inferenceProfile.length)
		}
	}

	if (modelId.startsWith("global.")) {
		return modelId.substring("global.".length)
	}

	return modelId
}

export function getPrefixForRegion(region: string): string | undefined {
	for (const [regionPattern, inferenceProfile] of AWS_INFERENCE_PROFILE_MAPPING) {
		if (region.startsWith(regionPattern)) {
			return inferenceProfile
		}
	}

	return undefined
}

export function isSystemInferenceProfile(prefix: string): boolean {
	for (const [_, inferenceProfile] of AWS_INFERENCE_PROFILE_MAPPING) {
		if (prefix === inferenceProfile) {
			return true
		}
	}
	return false
}

/**
 * Parses an Amazon Bedrock ARN into its components
 */
export function parseArn(
	arn: string,
	region?: string,
): {
	isValid: boolean
	modelId?: string
	modelType?: string
	region?: string
	errorMessage?: string
	awsUseCrossRegionInference?: boolean
} {
	if (!arn || typeof arn !== "string") {
		return { isValid: false, errorMessage: "ARN is required" }
	}

	const arnPattern = /^arn:aws:bedrock:([^:]+):([^:]*):([^/]+)\/(.+)$/
	const match = arn.match(arnPattern)

	if (!match) {
		return {
			isValid: false,
			errorMessage:
				"Invalid ARN format. Expected: arn:aws:bedrock:<region>:<account>:<resource-type>/<resource-id>",
		}
	}

	const [, arnRegion, , modelType, modelId] = match

	const isCrossRegion = region !== undefined && arnRegion !== region

	return {
		isValid: true,
		modelId,
		modelType,
		region: arnRegion,
		awsUseCrossRegionInference: isCrossRegion,
	}
}

/**
 * Looks up a model by ID from the bedrock models list, falling back to educated guess
 */
export function getModelById(
	modelId: string,
	_modelType?: string,
	_options?: { awsUseCrossRegionInference?: boolean; awsUseGlobalInference?: boolean; awsCustomArn?: string },
): { id: BedrockModelId | string; info: ModelInfo } {
	const knownModel = (bedrockModels as Record<string, ModelInfo>)[modelId]

	if (knownModel) {
		return { id: modelId as BedrockModelId, info: knownModel }
	}

	const guessedInfo = guessModelInfoFromId(modelId)

	return { id: modelId, info: guessedInfo as ModelInfo }
}

/**
 * Checks if a model ID supports 1M context window
 */
export function is1MContextModel(modelId: string): boolean {
	const modelIds = BEDROCK_1M_CONTEXT_MODEL_IDS as readonly string[]
	return modelIds.includes(modelId)
}
