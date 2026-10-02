import { useHandleInputChange } from "@src/features/settings/components/providers/provider-components/use-handle-input-change"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/features/foundation"

type BasetenProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

export const Baseten = ({ apiConfiguration, setApiConfigurationField }: BasetenProps) => {
	const { t } = useAppTranslation()

	const handleInputChange = useHandleInputChange(setApiConfigurationField)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.basetenApiKey || ""}
				type="password"
				onInput={handleInputChange("basetenApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.basetenApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.basetenApiKey && (
				<VSCodeButtonLink href="https://app.baseten.co/settings/api_keys" appearance="secondary">
					{t("settings:providers.getBasetenApiKey")}
				</VSCodeButtonLink>
			)}
		</>
	)
}
