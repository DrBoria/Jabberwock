import { ThinkingBudget } from "@src/features/settings/components/ThinkingBudget/components/main"
import { Verbosity } from "@src/features/settings/components/about-general/Verbosity"
import type { ExtraSettingsSectionProps } from "@src/features/settings/components/ApiOptions/types"

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
