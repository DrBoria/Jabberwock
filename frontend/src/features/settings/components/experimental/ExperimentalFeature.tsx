import { useAppTranslation } from "@/i18n/TranslationContext"

import { FeatureToggleHeader } from "./feature-toggle"

interface ExperimentalFeatureProps {
	enabled: boolean
	onChange: (value: boolean) => void
	// Additional property to identify the experiment
	experimentKey?: string
}

export const ExperimentalFeature = ({ enabled, onChange, experimentKey }: ExperimentalFeatureProps) => {
	const { t } = useAppTranslation()

	// Generate translation keys based on experiment key
	const nameKey = experimentKey ? `settings:experimental.${experimentKey}.name` : ""
	const descriptionKey = experimentKey ? `settings:experimental.${experimentKey}.description` : ""

	return (
		<FeatureToggleHeader enabled={enabled} onChange={onChange} name={t(nameKey)} description={t(descriptionKey)} />
	)
}
