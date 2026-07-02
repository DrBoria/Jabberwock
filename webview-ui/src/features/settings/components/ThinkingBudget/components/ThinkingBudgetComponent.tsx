import {
	DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS,
	DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS,
	GEMINI_25_PRO_MIN_THINKING_TOKENS,
} from "@shared/api"
import { useSelectedModel } from "@src/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"
import type { ThinkingBudgetProps } from "../types"
import { getReasoningCapabilities, getEffortConfig, getDefaultReasoningEffort, getCurrentEffort } from "../helpers"
import { useDefaultReasoningEffortSync, useEnableReasoningEffortSync, useMaxThinkingTokensSync } from "../hooks"
import { ThinkingBudgetBody } from "./ThinkingBudgetBody"

export const ThinkingBudget = ({ apiConfiguration, setApiConfigurationField, modelInfo }: ThinkingBudgetProps) => {
	const { id: selectedModelId } = useSelectedModel(apiConfiguration)
	const isGemini25Pro = !!(selectedModelId && selectedModelId.includes("gemini-2.5-pro"))
	const minThinkingTokens = isGemini25Pro ? GEMINI_25_PRO_MIN_THINKING_TOKENS : 1024
	const capabilities = getReasoningCapabilities(modelInfo)
	const { availableOptions } = getEffortConfig(modelInfo, modelInfo?.supportsReasoningEffort)
	const defaultReasoningEffort = getDefaultReasoningEffort(modelInfo)
	const currentReasoningEffort = getCurrentEffort(modelInfo, apiConfiguration.reasoningEffort)
	useDefaultReasoningEffortSync(
		capabilities.isReasoningEffortSupported,
		apiConfiguration,
		defaultReasoningEffort,
		modelInfo,
		setApiConfigurationField,
	)
	const enableReasoningEffort = apiConfiguration.enableReasoningEffort
	useEnableReasoningEffortSync(
		capabilities.isReasoningEffortSupported,
		modelInfo,
		currentReasoningEffort,
		enableReasoningEffort,
		setApiConfigurationField,
	)
	const customMaxOutputTokens = apiConfiguration.modelMaxTokens ?? DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS
	const customMaxThinkingTokens =
		apiConfiguration.modelMaxThinkingTokens ?? DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS
	const modelMaxThinkingTokens = modelInfo?.maxThinkingTokens
		? Math.min(modelInfo.maxThinkingTokens, Math.floor(0.8 * customMaxOutputTokens))
		: Math.floor(0.8 * customMaxOutputTokens)
	useMaxThinkingTokensSync(
		capabilities.isReasoningBudgetSupported,
		customMaxThinkingTokens,
		modelMaxThinkingTokens,
		setApiConfigurationField,
	)
	if (!modelInfo) return null
	return (
		<ThinkingBudgetBody
			modelInfo={modelInfo}
			state={{
				isReasoningSupported: capabilities.isReasoningSupported,
				isReasoningBudgetSupported: capabilities.isReasoningBudgetSupported,
				isReasoningBudgetRequired: capabilities.isReasoningBudgetRequired,
				isReasoningEffortSupported: capabilities.isReasoningEffortSupported,
				enableReasoningEffort,
				minThinkingTokens,
				customMaxOutputTokens,
				customMaxThinkingTokens,
				modelMaxThinkingTokens,
				availableOptions,
				currentReasoningEffort,
			}}
			setApiConfigurationField={setApiConfigurationField}
		/>
	)
}
