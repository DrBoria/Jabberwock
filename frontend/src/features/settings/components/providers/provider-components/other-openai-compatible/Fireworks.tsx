import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/features/foundation/components/ui/button/VSCodeButtonLink"

import { inputEventTransform } from "../../../shared/transforms"

type FireworksProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Fireworks = ({ apiConfiguration, setApiConfigurationField }: FireworksProps) => {
	const { t } = useAppTranslation()

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(field: K, transform?: (event: E) => ProviderSettings[K]) =>
			(event: E | Event) => {
				setApiConfigurationField(
					field,
					transform
						? transform(event as E)
						: (inputEventTransform(event as { target: HTMLInputElement }) as ProviderSettings[K]),
				)
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.fireworksApiKey || ""}
				type="password"
				onInput={handleInputChange("fireworksApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.fireworksApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.fireworksApiKey && (
				<VSCodeButtonLink href="https://fireworks.ai/" appearance="secondary">
					{t("settings:providers.getFireworksApiKey")}
				</VSCodeButtonLink>
			)}
		</>
	)
}
