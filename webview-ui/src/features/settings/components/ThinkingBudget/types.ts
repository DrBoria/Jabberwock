import type { ModelInfo, ProviderSettings, ReasoningEffortWithMinimal } from "@jabberwock/types"

export interface ThinkingBudgetProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	modelInfo?: ModelInfo
}

export interface ThinkingBudgetState {
	isReasoningSupported: boolean
	isReasoningBudgetSupported: boolean
	isReasoningBudgetRequired: boolean
	isReasoningEffortSupported: boolean
	enableReasoningEffort?: boolean
	minThinkingTokens: number
	customMaxOutputTokens: number
	customMaxThinkingTokens: number
	modelMaxThinkingTokens: number
	availableOptions: readonly ReasoningEffortOption[]
	currentReasoningEffort: ReasoningEffortOption
}

export type ReasoningEffortOption = "disable" | "none" | ReasoningEffortWithMinimal

export interface ReasoningBinaryToggleProps {
	enableReasoningEffort?: boolean
	setApiConfigurationField: ThinkingBudgetProps["setApiConfigurationField"]
}

export interface ReasoningToggleCheckboxProps {
	enableReasoningEffort?: boolean
	required: boolean
	onChange: (checked: boolean) => void
	label: string
}

export interface ReasoningBudgetSlidersProps {
	modelInfo: ModelInfo
	enableReasoningEffort?: boolean
	isReasoningBudgetRequired: boolean
	minThinkingTokens: number
	customMaxOutputTokens: number
	customMaxThinkingTokens: number
	modelMaxThinkingTokens: number
	setApiConfigurationField: ThinkingBudgetProps["setApiConfigurationField"]
}

export interface ReasoningEffortSelectorProps {
	currentReasoningEffort: ReasoningEffortOption
	availableOptions: readonly ReasoningEffortOption[]
	onEffortChange: (value: ReasoningEffortOption) => void
}

export interface ThinkingBudgetBodyProps {
	modelInfo: ModelInfo
	state: ThinkingBudgetState
	setApiConfigurationField: ThinkingBudgetProps["setApiConfigurationField"]
}
