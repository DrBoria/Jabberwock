import type { ModelInfo } from "../../models/model.ts"

// https://ai.google.dev/gemini-api/docs/models/gemini
export const geminiModelsPart1 = {
	"gemini-3.1-pro-preview": {
		maxTokens: 65_536,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningEffort: ["low", "medium", "high"],
		reasoningEffort: "low",

		supportsTemperature: true,
		defaultTemperature: 1,
		inputPrice: 4.0,
		outputPrice: 18.0,
		cacheReadsPrice: 0.4,
		cacheWritesPrice: 4.5,
		tiers: [
			{
				contextWindow: 200_000,
				inputPrice: 2.0,
				outputPrice: 12.0,
				cacheReadsPrice: 0.2,
			},
			{
				contextWindow: Infinity,
				inputPrice: 4.0,
				outputPrice: 18.0,
				cacheReadsPrice: 0.4,
			},
		],
	},
	"gemini-3.1-pro-preview-customtools": {
		maxTokens: 65_536,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningEffort: ["low", "medium", "high"],
		reasoningEffort: "low",

		supportsTemperature: true,
		defaultTemperature: 1,
		inputPrice: 4.0,
		outputPrice: 18.0,
		cacheReadsPrice: 0.4,
		cacheWritesPrice: 4.5,
		tiers: [
			{
				contextWindow: 200_000,
				inputPrice: 2.0,
				outputPrice: 12.0,
				cacheReadsPrice: 0.2,
			},
			{
				contextWindow: Infinity,
				inputPrice: 4.0,
				outputPrice: 18.0,
				cacheReadsPrice: 0.4,
			},
		],
	},
	"gemini-3-pro-preview": {
		maxTokens: 65_536,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningEffort: ["low", "high"],
		reasoningEffort: "low",

		supportsTemperature: true,
		defaultTemperature: 1,
		inputPrice: 4.0,
		outputPrice: 18.0,
		cacheReadsPrice: 0.4,
		tiers: [
			{
				contextWindow: 200_000,
				inputPrice: 2.0,
				outputPrice: 12.0,
				cacheReadsPrice: 0.2,
			},
			{
				contextWindow: Infinity,
				inputPrice: 4.0,
				outputPrice: 18.0,
				cacheReadsPrice: 0.4,
			},
		],
	},
	"gemini-3-flash-preview": {
		maxTokens: 65_536,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoningEffort: ["minimal", "low", "medium", "high"],
		reasoningEffort: "medium",

		supportsTemperature: true,
		defaultTemperature: 1,
		inputPrice: 0.5,
		outputPrice: 3.0,
		cacheReadsPrice: 0.05,
	},
	// 2.5 Pro models
	"gemini-2.5-pro": {
		maxTokens: 64_000,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,

		inputPrice: 2.5, // This is the pricing for prompts above 200k tokens.
		outputPrice: 15,
		cacheReadsPrice: 0.625,
		cacheWritesPrice: 4.5,
		maxThinkingTokens: 32_768,
		supportsReasoningBudget: true,
		requiredReasoningBudget: true,
		tiers: [
			{
				contextWindow: 200_000,
				inputPrice: 1.25,
				outputPrice: 10,
				cacheReadsPrice: 0.31,
			},
			{
				contextWindow: Infinity,
				inputPrice: 2.5,
				outputPrice: 15,
				cacheReadsPrice: 0.625,
			},
		],
	},
	"gemini-2.5-pro-preview-06-05": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,

		inputPrice: 2.5, // This is the pricing for prompts above 200k tokens.
		outputPrice: 15,
		cacheReadsPrice: 0.625,
		cacheWritesPrice: 4.5,
		maxThinkingTokens: 32_768,
		supportsReasoningBudget: true,
		tiers: [
			{
				contextWindow: 200_000,
				inputPrice: 1.25,
				outputPrice: 10,
				cacheReadsPrice: 0.31,
			},
			{
				contextWindow: Infinity,
				inputPrice: 2.5,
				outputPrice: 15,
				cacheReadsPrice: 0.625,
			},
		],
	},
} as const satisfies Record<string, ModelInfo>
