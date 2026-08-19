import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, type RouterModels, mistralDefaultModelId } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/features/foundation/components/ui/button/VSCodeButtonLink"

import { inputEventTransform } from "../../../shared/transforms"

type MistralProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	simplifySettings?: boolean
}

function isCodestralSelected(apiModelId: string | undefined) {
	return apiModelId?.startsWith("codestral-") || (!apiModelId && mistralDefaultModelId.startsWith("codestral-"))
}

function MissingApiKeySection({ t }: { t: (key: string) => string }) {
	return (
		<VSCodeButtonLink href="https://console.mistral.ai/" appearance="secondary">
			{t("settings:providers.getMistralApiKey")}
		</VSCodeButtonLink>
	)
}

function CodestralUrlSection({
	apiConfiguration,
	setApiConfigurationField,
	t,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	t: (key: string) => string
}) {
	const handleChange = useCallback(
		(event: Event | React.FormEvent<HTMLElement>) => {
			setApiConfigurationField(
				"mistralCodestralUrl",
				inputEventTransform({ target: event.target as HTMLInputElement }),
			)
		},
		[setApiConfigurationField],
	)
	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.mistralCodestralUrl || ""}
				type="url"
				onInput={handleChange}
				placeholder="https://codestral.mistral.ai"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.codestralBaseUrl")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.codestralBaseUrlDesc")}
			</div>
		</>
	)
}

export const Mistral = ({ apiConfiguration, setApiConfigurationField }: MistralProps) => {
	const { t } = useAppTranslation()

	const handleApiKeyChange = useCallback(
		(event: Event | React.FormEvent<HTMLElement>) => {
			setApiConfigurationField("mistralApiKey", inputEventTransform({ target: event.target as HTMLInputElement }))
		},
		[setApiConfigurationField],
	)

	const showCodestralUrl = isCodestralSelected(apiConfiguration?.apiModelId)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.mistralApiKey || ""}
				type="password"
				onInput={handleApiKeyChange}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<span className="font-medium">{t("settings:providers.mistralApiKey")}</span>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.mistralApiKey && <MissingApiKeySection t={t} />}
			{showCodestralUrl && (
				<CodestralUrlSection
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					t={t}
				/>
			)}
		</>
	)
}
