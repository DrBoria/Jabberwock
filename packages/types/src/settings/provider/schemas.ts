import { z } from "zod"

import {
	modelInfoSchema,
	reasoningEffortSettingSchema,
	verbosityLevelsSchema,
	serviceTierSchema,
} from "../../models/model.ts"
import { providerNamesWithRetiredSchema } from "./categories.ts"

/**
 * ProviderSettingsEntry
 */

export const providerSettingsEntrySchema = z.object({
	id: z.string(),
	name: z.string(),
	apiProvider: providerNamesWithRetiredSchema.optional(),
	modelId: z.string().optional(),
})

export type ProviderSettingsEntry = z.infer<typeof providerSettingsEntrySchema>

/**
 * Base schemas
 */

const baseProviderSettingsSchema = z.object({
	includeMaxTokens: z.boolean().optional(),
	todoListEnabled: z.boolean().optional(),
	modelTemperature: z.number().nullish(),
	rateLimitSeconds: z.number().optional(),
	consecutiveMistakeLimit: z.number().min(0).optional(),

	// Model reasoning.
	enableReasoningEffort: z.boolean().optional(),
	reasoningEffort: reasoningEffortSettingSchema.optional(),
	modelMaxTokens: z.number().optional(),
	modelMaxThinkingTokens: z.number().optional(),

	// Model verbosity.
	verbosity: verbosityLevelsSchema.optional(),
})

// Several of the providers share common model config properties.
const apiModelIdProviderModelSchema = baseProviderSettingsSchema.extend({
	apiModelId: z.string().optional(),
})

export const anthropicSchema = apiModelIdProviderModelSchema.extend({
	apiKey: z.string().optional(),
	anthropicBaseUrl: z.string().optional(),
	anthropicUseAuthToken: z.boolean().optional(),
	anthropicBeta1MContext: z.boolean().optional(), // Enable 'context-1m-2025-08-07' beta for 1M context window.
})

export const openRouterSchema = baseProviderSettingsSchema.extend({
	openRouterApiKey: z.string().optional(),
	openRouterModelId: z.string().optional(),
	openRouterBaseUrl: z.string().optional(),
	openRouterSpecificProvider: z.string().optional(),
})

export const bedrockSchema = apiModelIdProviderModelSchema.extend({
	awsAccessKey: z.string().optional(),
	awsSecretKey: z.string().optional(),
	awsSessionToken: z.string().optional(),
	awsRegion: z.string().optional(),
	awsUseCrossRegionInference: z.boolean().optional(),
	awsUseGlobalInference: z.boolean().optional(), // Enable Global Inference profile routing when supported
	awsUsePromptCache: z.boolean().optional(),
	awsProfile: z.string().optional(),
	awsUseProfile: z.boolean().optional(),
	awsApiKey: z.string().optional(),
	awsUseApiKey: z.boolean().optional(),
	awsCustomArn: z.string().optional(),
	awsModelContextWindow: z.number().optional(),
	awsBedrockEndpointEnabled: z.boolean().optional(),
	awsBedrockEndpoint: z.string().optional(),
	awsBedrock1MContext: z.boolean().optional(), // Enable 'context-1m-2025-08-07' beta for 1M context window.
	awsBedrockServiceTier: z.enum(["STANDARD", "FLEX", "PRIORITY"]).optional(), // AWS Bedrock service tier selection
})

export const vertexSchema = apiModelIdProviderModelSchema.extend({
	vertexKeyFile: z.string().optional(),
	vertexJsonCredentials: z.string().optional(),
	vertexProjectId: z.string().optional(),
	vertexRegion: z.string().optional(),
	vertex1MContext: z.boolean().optional(), // Enable 'context-1m-2025-08-07' beta for 1M context window.
})

export const openAiSchema = baseProviderSettingsSchema.extend({
	openAiBaseUrl: z.string().optional(),
	openAiApiKey: z.string().optional(),
	openAiR1FormatEnabled: z.boolean().optional(),
	openAiModelId: z.string().optional(),
	openAiCustomModelInfo: modelInfoSchema.nullish(),
	openAiUseAzure: z.boolean().optional(),
	azureApiVersion: z.string().optional(),
	openAiStreamingEnabled: z.boolean().optional(),
	openAiHostHeader: z.string().optional(), // Keep temporarily for backward compatibility during migration.
	openAiHeaders: z.record(z.string(), z.string()).optional(),
})

export const ollamaSchema = baseProviderSettingsSchema.extend({
	ollamaModelId: z.string().optional(),
	ollamaBaseUrl: z.string().optional(),
	ollamaApiKey: z.string().optional(),
	ollamaNumCtx: z.number().int().min(128).optional(),
})

export const vsCodeLmSchema = baseProviderSettingsSchema.extend({
	vsCodeLmModelSelector: z
		.object({
			vendor: z.string().optional(),
			family: z.string().optional(),
			version: z.string().optional(),
			id: z.string().optional(),
		})
		.optional(),
})

export const lmStudioSchema = baseProviderSettingsSchema.extend({
	lmStudioModelId: z.string().optional(),
	lmStudioBaseUrl: z.string().optional(),
	lmStudioDraftModelId: z.string().optional(),
	lmStudioSpeculativeDecodingEnabled: z.boolean().optional(),
})

export const geminiSchema = apiModelIdProviderModelSchema.extend({
	geminiApiKey: z.string().optional(),
	googleGeminiBaseUrl: z.string().optional(),
})

export const geminiCliSchema = apiModelIdProviderModelSchema.extend({
	geminiCliOAuthPath: z.string().optional(),
	geminiCliProjectId: z.string().optional(),
})

export const openAiCodexSchema = apiModelIdProviderModelSchema.extend({
	// No additional settings needed - uses OAuth authentication
})

export const openAiNativeSchema = apiModelIdProviderModelSchema.extend({
	openAiNativeApiKey: z.string().optional(),
	openAiNativeBaseUrl: z.string().optional(),
	// OpenAI Responses API service tier for openai-native provider only.
	// UI should only expose this when the selected model supports flex/priority.
	openAiNativeServiceTier: serviceTierSchema.optional(),
})

export const mistralSchema = apiModelIdProviderModelSchema.extend({
	mistralApiKey: z.string().optional(),
	mistralCodestralUrl: z.string().optional(),
})

export const deepSeekSchema = apiModelIdProviderModelSchema.extend({
	deepSeekBaseUrl: z.string().optional(),
	deepSeekApiKey: z.string().optional(),
})

export const moonshotSchema = apiModelIdProviderModelSchema.extend({
	moonshotBaseUrl: z
		.union([z.literal("https://api.moonshot.ai/v1"), z.literal("https://api.moonshot.cn/v1")])
		.optional(),
	moonshotApiKey: z.string().optional(),
})

export const minimaxSchema = apiModelIdProviderModelSchema.extend({
	minimaxBaseUrl: z
		.union([z.literal("https://api.minimax.io/v1"), z.literal("https://api.minimaxi.com/v1")])
		.optional(),
	minimaxApiKey: z.string().optional(),
})

export const requestySchema = baseProviderSettingsSchema.extend({
	requestyBaseUrl: z.string().optional(),
	requestyApiKey: z.string().optional(),
	requestyModelId: z.string().optional(),
})

export const unboundSchema = baseProviderSettingsSchema.extend({
	unboundApiKey: z.string().optional(),
	unboundModelId: z.string().optional(),
})

export const fakeAiSchema = baseProviderSettingsSchema.extend({
	fakeAi: z.unknown().optional(),
})

export const xaiSchema = apiModelIdProviderModelSchema.extend({
	xaiApiKey: z.string().optional(),
})

export const litellmSchema = baseProviderSettingsSchema.extend({
	litellmBaseUrl: z.string().optional(),
	litellmApiKey: z.string().optional(),
	litellmModelId: z.string().optional(),
	litellmUsePromptCache: z.boolean().optional(),
})

export const sambaNovaSchema = apiModelIdProviderModelSchema.extend({
	sambaNovaApiKey: z.string().optional(),
})

export const zaiApiLineSchema = z.enum(["international_coding", "china_coding", "international_api", "china_api"])

export type ZaiApiLine = z.infer<typeof zaiApiLineSchema>

export const zaiSchema = apiModelIdProviderModelSchema.extend({
	zaiApiKey: z.string().optional(),
	zaiApiLine: zaiApiLineSchema.optional(),
})

export const fireworksSchema = apiModelIdProviderModelSchema.extend({
	fireworksApiKey: z.string().optional(),
})

export const qwenCodeSchema = apiModelIdProviderModelSchema.extend({
	qwenCodeOauthPath: z.string().optional(),
})

export const jabberwockSchema = apiModelIdProviderModelSchema.extend({
	// Can use cloud authentication or provide an API key (cli).
	jabberwockCloudApiKey: z.string().optional(),
	jabberwockApiKey: z.string().optional(),
})

export const vercelAiGatewaySchema = baseProviderSettingsSchema.extend({
	vercelAiGatewayApiKey: z.string().optional(),
	vercelAiGatewayModelId: z.string().optional(),
})

export const basetenSchema = apiModelIdProviderModelSchema.extend({
	basetenApiKey: z.string().optional(),
})

export const defaultSchema = z.object({
	apiProvider: z.undefined(),
})
