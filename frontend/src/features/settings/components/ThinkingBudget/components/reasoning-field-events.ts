import type { ThinkingBudgetProps } from "@src/features/settings/components/ThinkingBudget/types"

/**
 * Shared checkbox handler for the "use reasoning" toggle: normalizes the
 * checkbox's tri-state to a boolean and writes `enableReasoningEffort`.
 */
export const makeEnableReasoningHandler =
	(setApiConfigurationField: ThinkingBudgetProps["setApiConfigurationField"]) => (checked: boolean) => {
		setApiConfigurationField("enableReasoningEffort", checked === true)
	}
