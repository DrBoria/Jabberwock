import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/features/foundation/components/ui/button/VSCodeButtonLink"
import { useSelectedModel } from "@src/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"

import { inputEventTransform, noTransform } from "../../../shared/transforms"

type AnthropicProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
}

const is1MContextBetaModel = (modelId: string | undefined): boolean =>
	modelId === "claude-sonnet-4-20250514" ||
	modelId === "claude-sonnet-4-5" ||
	modelId === "claude-sonnet-4-6" ||
	modelId === "claude-opus-4-6"

type ApiKeySectionProps = {
	apiKey?: string
	onApiKeyInput: (event: Event | React.FormEvent<HTMLElement>) => void
	t: (key: string) => string
}

const ApiKeySection = ({ apiKey, onApiKeyInput, t }: ApiKeySectionProps) => (
	<>
		<VSCodeTextField
			value={apiKey || ""}
			type="password"
			onInput={onApiKeyInput}
			placeholder={t("settings:placeholders.apiKey")}
			className="w-full">
			<label className="block font-medium mb-1">{t("settings:providers.anthropicApiKey")}</label>
		</VSCodeTextField>
		<div className="text-sm text-vscode-descriptionForeground -mt-2">
			{t("settings:providers.apiKeyStorageNotice")}
		</div>
		{!apiKey && (
			<VSCodeButtonLink href="https://console.anthropic.com/settings/keys" appearance="secondary">
				{t("settings:providers.getAnthropicApiKey")}
			</VSCodeButtonLink>
		)}
	</>
)

type CustomBaseUrlSectionProps = {
	baseUrlSelected: boolean
	baseUrl?: string
	useAuthToken?: boolean
	onToggleBaseUrl: (checked: boolean) => void
	onBaseUrlInput: (event: Event | React.FormEvent<HTMLElement>) => void
	onAuthTokenChange: (checked: boolean) => void
	t: (key: string) => string
}

const CustomBaseUrlSection = ({
	baseUrlSelected,
	baseUrl,
	useAuthToken,
	onToggleBaseUrl,
	onBaseUrlInput,
	onAuthTokenChange,
	t,
}: CustomBaseUrlSectionProps) => (
	<div>
		<Checkbox checked={baseUrlSelected} onChange={onToggleBaseUrl}>
			{t("settings:providers.useCustomBaseUrl")}
		</Checkbox>
		{baseUrlSelected && (
			<>
				<VSCodeTextField
					value={baseUrl || ""}
					type="url"
					onInput={onBaseUrlInput}
					placeholder="https://api.anthropic.com"
					className="w-full mt-1"
				/>
				<Checkbox checked={useAuthToken ?? false} onChange={onAuthTokenChange} className="w-full mt-1">
					{t("settings:providers.anthropicUseAuthToken")}
				</Checkbox>
			</>
		)}
	</div>
)

type BetaSectionProps = {
	betaEnabled?: boolean
	onToggleBeta: (checked: boolean) => void
	t: (key: string) => string
}

const BetaSection = ({ betaEnabled, onToggleBeta, t }: BetaSectionProps) => (
	<div>
		<Checkbox checked={betaEnabled ?? false} onChange={onToggleBeta}>
			{t("settings:providers.anthropic1MContextBetaLabel")}
		</Checkbox>
		<div className="text-sm text-vscode-descriptionForeground mt-1 ml-6">
			{t("settings:providers.anthropic1MContextBetaDescription")}
		</div>
	</div>
)

export const Anthropic = ({ apiConfiguration, setApiConfigurationField }: AnthropicProps) => {
	const { t } = useAppTranslation()
	const selectedModel = useSelectedModel(apiConfiguration)

	const [anthropicBaseUrlSelected, setAnthropicBaseUrlSelected] = useState(!!apiConfiguration?.anthropicBaseUrl)

	const supports1MContextBeta = is1MContextBetaModel(selectedModel?.id)

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

	const handleToggleBaseUrl = useCallback(
		(checked: boolean) => {
			setAnthropicBaseUrlSelected(checked)

			if (!checked) {
				setApiConfigurationField("anthropicBaseUrl", "")
				setApiConfigurationField("anthropicUseAuthToken", false)
			}
		},
		[setApiConfigurationField],
	)

	const handleToggleBeta = useCallback(
		(checked: boolean) => {
			setApiConfigurationField("anthropicBeta1MContext", checked)
		},
		[setApiConfigurationField],
	)

	return (
		<>
			<ApiKeySection apiKey={apiConfiguration?.apiKey} onApiKeyInput={handleInputChange("apiKey")} t={t} />
			<CustomBaseUrlSection
				baseUrlSelected={anthropicBaseUrlSelected}
				baseUrl={apiConfiguration?.anthropicBaseUrl}
				useAuthToken={apiConfiguration?.anthropicUseAuthToken}
				onToggleBaseUrl={handleToggleBaseUrl}
				onBaseUrlInput={handleInputChange("anthropicBaseUrl")}
				onAuthTokenChange={handleInputChange("anthropicUseAuthToken", noTransform)}
				t={t}
			/>
			{supports1MContextBeta && (
				<BetaSection
					betaEnabled={apiConfiguration?.anthropicBeta1MContext}
					onToggleBeta={handleToggleBeta}
					t={t}
				/>
			)}
		</>
	)
}
