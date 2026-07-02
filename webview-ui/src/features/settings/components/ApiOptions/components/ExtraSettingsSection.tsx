import { ThinkingBudget } from "../../ThinkingBudget/components/ThinkingBudgetComponent"
import { Verbosity } from "../../about-general/Verbosity"
import type { ExtraSettingsSectionProps } from "../types"

export const ExtraSettingsSection = ({
	fromWelcomeView,
	selectedProvider,
	selectedModelId,
	apiConfiguration,
	setApiConfigurationField,
	selectedModelInfo,
}: ExtraSettingsSectionProps) => {
	if (fromWelcomeView) return null
	return (
		<>
			<ThinkingBudget
				key={`${selectedProvider}-${selectedModelId}`}
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				modelInfo={selectedModelInfo}
			/>
			{selectedModelInfo?.supportsVerbosity && (
				<Verbosity
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					modelInfo={selectedModelInfo}
				/>
			)}
		</>
	)
}
