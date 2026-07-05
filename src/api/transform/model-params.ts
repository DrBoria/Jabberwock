import {
	type ModelInfo,
	type ProviderSettings,
	type VerbosityLevel,
	type ReasoningEffortExtended,
} from "@jabberwock/types"

import {
	DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS,
	GEMINI_25_PRO_MIN_THINKING_TOKENS,
	shouldUseReasoningBudget,
	shouldUseReasoningEffort,
	getModelMaxOutputTokens,
} from "@shared/api"

import {
	type AnthropicReasoningParams,
	type OpenAiReasoningParams,
	type GeminiReasoningParams,
	type OpenRouterReasoningParams,
	getAnthropicReasoning,
	getOpenAiReasoning,
	getGeminiReasoning,
	getOpenRouterReasoning,
} from "./content/reasoning"

type Format = "anthropic" | "openai" | "gemini" | "openrouter"

type GetModelParamsOptions<T extends Format> = {
	format: T
	modelId: string
	model: ModelInfo
	settings: ProviderSettings
	defaultTemperature: number
}

type BaseModelParams = {
	maxTokens: number | undefined
	temperature: number | undefined
	reasoningEffort: ReasoningEffortExtended | undefined
	reasoningBudget: number | undefined
	verbosity: VerbosityLevel | undefined
	tools?: boolean
}

type AnthropicModelParams = {
	format: "anthropic"
	reasoning: AnthropicReasoningParams | undefined
} & BaseModelParams

type OpenAiModelParams = {
	format: "openai"
	reasoning: OpenAiReasoningParams | undefined
} & BaseModelParams

type GeminiModelParams = {
	format: "gemini"
	reasoning: GeminiReasoningParams | undefined
} & BaseModelParams

type OpenRouterModelParams = {
	format: "openrouter"
	reasoning: OpenRouterReasoningParams | undefined
} & BaseModelParams

export type ModelParams = AnthropicModelParams | OpenAiModelParams | GeminiModelParams | OpenRouterModelParams

function resolveReasoningBudget(
	model: ModelInfo,
	settings: ProviderSettings,
	maxTokens: number | undefined,
	modelId: string,
): { reasoningBudget: number | undefined; temperature: number | undefined } {
	const { modelMaxThinkingTokens: customMaxThinkingTokens } = settings

	const isGemini25Pro = modelId.includes("gemini-2.5-pro")
	const defaultThinkingTokens = isGemini25Pro
		? GEMINI_25_PRO_MIN_THINKING_TOKENS
		: DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS
	let reasoningBudget = customMaxThinkingTokens ?? defaultThinkingTokens

	if (maxTokens && reasoningBudget > Math.floor(maxTokens * 0.8)) {
		reasoningBudget = Math.floor(maxTokens * 0.8)
	}

	const minThinkingTokens = isGemini25Pro ? GEMINI_25_PRO_MIN_THINKING_TOKENS : 1024
	if (reasoningBudget < minThinkingTokens) {
		reasoningBudget = minThinkingTokens
	}

	return { reasoningBudget, temperature: 1.0 }
}

function resolveReasoningEffort(settings: ProviderSettings, model: ModelInfo): ReasoningEffortExtended | undefined {
	const { reasoningEffort: customReasoningEffort } = settings

	const effort =
		customReasoningEffort !== undefined
			? customReasoningEffort
			: (model.reasoningEffort as ReasoningEffortExtended | "disable" | undefined)

	if (effort && effort !== "disable") {
		return effort as ReasoningEffortExtended
	}

	return undefined
}

function buildAnthropicParams(
	params: BaseModelParams,
	model: ModelInfo,
	settings: ProviderSettings,
): AnthropicModelParams {
	return {
		format: "anthropic",
		...params,
		reasoning: getAnthropicReasoning({
			model,
			reasoningBudget: params.reasoningBudget,
			reasoningEffort: params.reasoningEffort,
			settings,
		}),
	}
}

function buildOpenAiParams(
	params: BaseModelParams,
	modelId: string,
	model: ModelInfo,
	settings: ProviderSettings,
): OpenAiModelParams {
	if (modelId.startsWith("o1") || modelId.startsWith("o3-mini")) {
		params.temperature = undefined
	}

	return {
		format: "openai",
		...params,
		reasoning: getOpenAiReasoning({
			model,
			reasoningBudget: params.reasoningBudget,
			reasoningEffort: params.reasoningEffort,
			settings,
		}),
	}
}

function buildGeminiParams(params: BaseModelParams, model: ModelInfo, settings: ProviderSettings): GeminiModelParams {
	return {
		format: "gemini",
		...params,
		reasoning: getGeminiReasoning({
			model,
			reasoningBudget: params.reasoningBudget,
			reasoningEffort: params.reasoningEffort,
			settings,
		}),
	}
}

function buildOpenRouterParams(
	params: BaseModelParams,
	modelId: string,
	model: ModelInfo,
	settings: ProviderSettings,
): OpenRouterModelParams {
	if (modelId === "openai/o1-pro") {
		params.temperature = undefined
	}

	return {
		format: "openrouter",
		...params,
		reasoning: getOpenRouterReasoning({
			model,
			reasoningBudget: params.reasoningBudget,
			reasoningEffort: params.reasoningEffort,
			settings,
		}),
	}
}

// Function overloads for specific return types
export function getModelParams(options: GetModelParamsOptions<"anthropic">): AnthropicModelParams
export function getModelParams(options: GetModelParamsOptions<"openai">): OpenAiModelParams
export function getModelParams(options: GetModelParamsOptions<"gemini">): GeminiModelParams
export function getModelParams(options: GetModelParamsOptions<"openrouter">): OpenRouterModelParams

export function getModelParams({
	format,
	modelId,
	model,
	settings,
	defaultTemperature,
}: GetModelParamsOptions<Format>): ModelParams {
	const { modelTemperature: customTemperature, verbosity: customVerbosity } = settings

	const maxTokens = getModelMaxOutputTokens({ modelId, model, settings, format })

	let temperature: number | undefined = customTemperature ?? model.defaultTemperature ?? defaultTemperature
	let reasoningBudget: ModelParams["reasoningBudget"] = undefined
	let reasoningEffort: ModelParams["reasoningEffort"] = undefined

	if (shouldUseReasoningBudget({ model, settings })) {
		const budgetResult = resolveReasoningBudget(model, settings, maxTokens, modelId)
		reasoningBudget = budgetResult.reasoningBudget
		temperature = budgetResult.temperature
	} else if (shouldUseReasoningEffort({ model, settings })) {
		reasoningEffort = resolveReasoningEffort(settings, model)
	}

	const params: BaseModelParams = {
		maxTokens,
		temperature,
		reasoningEffort,
		reasoningBudget,
		verbosity: customVerbosity,
	}

	switch (format) {
		case "anthropic":
			return buildAnthropicParams(params, model, settings)
		case "openai":
			return buildOpenAiParams(params, modelId, model, settings)
		case "gemini":
			return buildGeminiParams(params, model, settings)
		default:
			return buildOpenRouterParams(params, modelId, model, settings)
	}
}
