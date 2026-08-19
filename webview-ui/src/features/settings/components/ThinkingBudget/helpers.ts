import type { ModelInfo } from "@jabberwock/types"
import { reasoningEfforts } from "@jabberwock/types"
import type { ReasoningEffortOption } from "./types"

export const getBaseAvailableOptions = (
	supports: ModelInfo["supportsReasoningEffort"],
): readonly ReasoningEffortOption[] =>
	supports === true || supports === undefined
		? reasoningEfforts
		: Array.isArray(supports)
			? supports.filter(
					(v): v is ReasoningEffortOption =>
						v === "disable" ||
						v === "none" ||
						v === "minimal" ||
						v === "low" ||
						v === "medium" ||
						v === "high",
				)
			: reasoningEfforts

export const getDefaultReasoningEffort = (modelInfo: ModelInfo | undefined): ReasoningEffortOption => {
	if (!modelInfo?.requiredReasoningEffort) return "disable"
	const modelDefault = modelInfo.reasoningEffort
	if (
		modelDefault === "none" ||
		modelDefault === "minimal" ||
		modelDefault === "low" ||
		modelDefault === "medium" ||
		modelDefault === "high"
	)
		return modelDefault
	return "medium"
}

export const getEffortLabel = (value: string, t: (key: string) => string): string =>
	value === "none" || value === "disable"
		? t("settings:providers.reasoningEffort.none")
		: t(`settings:providers.reasoningEffort.${value}`)

export const getReasoningCapabilities = (modelInfo: ModelInfo | undefined) => ({
	isReasoningSupported: !!(modelInfo && modelInfo.supportsReasoningBinary),
	isReasoningBudgetSupported: !!(modelInfo && modelInfo.supportsReasoningBudget),
	isReasoningBudgetRequired: !!(modelInfo && modelInfo.requiredReasoningBudget),
	isReasoningEffortSupported: !!(modelInfo && modelInfo.supportsReasoningEffort),
})

export const getEffortConfig = (modelInfo: ModelInfo | undefined, supports: ModelInfo["supportsReasoningEffort"]) => {
	const baseAvailableOptions = getBaseAvailableOptions(supports)
	return {
		availableOptions:
			!modelInfo?.requiredReasoningEffort && supports === true
				? (["disable", ...baseAvailableOptions] as const)
				: baseAvailableOptions,
	}
}

export const getCurrentEffort = (
	modelInfo: ModelInfo | undefined,
	storedEffort: string | undefined,
): ReasoningEffortOption =>
	storedEffort === "xhigh" || storedEffort === undefined
		? getDefaultReasoningEffort(modelInfo)
		: (storedEffort as ReasoningEffortOption)
