import { useEffect } from "react"
import type { ThinkingBudgetProps, ReasoningEffortOption } from "./types"

export function useDefaultReasoningEffortSync(
	isReasoningEffortSupported: boolean,
	apiConfiguration: ThinkingBudgetProps["apiConfiguration"],
	defaultReasoningEffort: ReasoningEffortOption,
	modelInfo: ThinkingBudgetProps["modelInfo"],
	setApiConfigurationField: ThinkingBudgetProps["setApiConfigurationField"],
) {
	useEffect(() => {
		if (
			!isReasoningEffortSupported ||
			apiConfiguration.reasoningEffort ||
			!modelInfo?.requiredReasoningEffort ||
			defaultReasoningEffort === "disable"
		)
			return
		setApiConfigurationField("reasoningEffort", defaultReasoningEffort, false)
	}, [
		isReasoningEffortSupported,
		apiConfiguration.reasoningEffort,
		defaultReasoningEffort,
		modelInfo?.requiredReasoningEffort,
		setApiConfigurationField,
	])
}

export function useEnableReasoningEffortSync(
	isReasoningEffortSupported: boolean,
	modelInfo: ThinkingBudgetProps["modelInfo"],
	currentReasoningEffort: ReasoningEffortOption,
	enableReasoningEffort: boolean | undefined,
	setApiConfigurationField: ThinkingBudgetProps["setApiConfigurationField"],
) {
	useEffect(() => {
		if (!isReasoningEffortSupported) return
		const shouldEnable = !!(modelInfo?.requiredReasoningEffort || currentReasoningEffort !== "disable")
		if (shouldEnable && enableReasoningEffort !== true)
			setApiConfigurationField("enableReasoningEffort", true, false)
	}, [
		isReasoningEffortSupported,
		modelInfo?.requiredReasoningEffort,
		currentReasoningEffort,
		enableReasoningEffort,
		setApiConfigurationField,
	])
}

export function useMaxThinkingTokensSync(
	isReasoningBudgetSupported: boolean,
	customMaxThinkingTokens: number,
	modelMaxThinkingTokens: number,
	setApiConfigurationField: ThinkingBudgetProps["setApiConfigurationField"],
) {
	useEffect(() => {
		if (!isReasoningBudgetSupported || customMaxThinkingTokens <= modelMaxThinkingTokens) return
		setApiConfigurationField("modelMaxThinkingTokens", modelMaxThinkingTokens, false)
	}, [isReasoningBudgetSupported, customMaxThinkingTokens, modelMaxThinkingTokens, setApiConfigurationField])
}
