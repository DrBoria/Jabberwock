import { useHandleInputChange } from "@src/features/settings/components/providers/provider-components/use-handle-input-change"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/features/foundation"

type XAIProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const XAI = ({ apiConfiguration, setApiConfigurationField }: XAIProps) => {
	const { t } = useAppTranslation()

	const handleInputChange = useHandleInputChange(setApiConfigurationField)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.xaiApiKey || ""}
				type="password"
				onInput={handleInputChange("xaiApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.xaiApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.xaiApiKey && (
				<VSCodeButtonLink href="https://api.x.ai/docs" appearance="secondary">
					{t("settings:providers.getXaiApiKey")}
				</VSCodeButtonLink>
			)}
		</>
	)
}
