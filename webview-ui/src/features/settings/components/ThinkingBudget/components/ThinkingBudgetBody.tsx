import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { ThinkingBudgetBodyProps } from "../types"
import { ReasoningBinaryToggle } from "./ReasoningBinaryToggle"
import { ReasoningToggleCheckbox } from "./ReasoningToggleCheckbox"
import { ReasoningBudgetSliders } from "./ReasoningBudgetSliders"
import { ReasoningEffortSelector } from "./ReasoningEffortSelector"

export const ThinkingBudgetBody = ({ modelInfo, state, setApiConfigurationField }: ThinkingBudgetBodyProps) => {
	const { t } = useAppTranslation()
	if (state.isReasoningSupported)
		return (
			<ReasoningBinaryToggle
				enableReasoningEffort={state.enableReasoningEffort}
				setApiConfigurationField={setApiConfigurationField}
			/>
		)
	if (state.isReasoningBudgetSupported && !!modelInfo.maxTokens)
		return (
			<>
				<ReasoningToggleCheckbox
					enableReasoningEffort={state.enableReasoningEffort}
					required={state.isReasoningBudgetRequired}
					onChange={(checked: boolean) => setApiConfigurationField("enableReasoningEffort", checked === true)}
					label={t("settings:providers.useReasoning")}
				/>
				<ReasoningBudgetSliders
					modelInfo={modelInfo}
					enableReasoningEffort={state.enableReasoningEffort}
					isReasoningBudgetRequired={state.isReasoningBudgetRequired}
					minThinkingTokens={state.minThinkingTokens}
					customMaxOutputTokens={state.customMaxOutputTokens}
					customMaxThinkingTokens={state.customMaxThinkingTokens}
					modelMaxThinkingTokens={state.modelMaxThinkingTokens}
					setApiConfigurationField={setApiConfigurationField}
				/>
			</>
		)
	if (state.isReasoningEffortSupported)
		return (
			<ReasoningEffortSelector
				currentReasoningEffort={state.currentReasoningEffort}
				availableOptions={state.availableOptions}
				onEffortChange={(value) => {
					if (value === "disable") {
						setApiConfigurationField("enableReasoningEffort", false)
						setApiConfigurationField("reasoningEffort", "disable")
					} else {
						setApiConfigurationField("enableReasoningEffort", true)
						setApiConfigurationField("reasoningEffort", value)
					}
				}}
			/>
		)
	return null
}
