import { useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import {
	type ProviderSettings,
	type OrganizationAllowList,
	type RouterModels,
	openRouterDefaultModelId,
} from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getOpenRouterAuthUrl } from "@src/oauth/urls"
import { VSCodeButtonLink } from "@src/features/foundation/components/ui/button/VSCodeButtonLink"

import { inputEventTransform } from "../../../shared/transforms"

import { ModelPicker } from "../../../ModelPicker/ModelPickerComponent"
import { OpenRouterBalanceDisplay } from "../../balance-displays/OpenRouterBalanceDisplay"

type OpenRouterProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	selectedModelId: string
	uriScheme: string | undefined
	simplifySettings?: boolean
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

function safeValue(value: string | undefined | null, fallback = ""): string {
	if (value == null) return fallback
	return value
}

function handleInputChange<K extends keyof ProviderSettings, E>(
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void,
	field: K,
	transform?: (event: E) => ProviderSettings[K],
) {
	return (event: E | Event) => {
		setApiConfigurationField(
			field,
			transform
				? transform(event as E)
				: (inputEventTransform(event as { target: HTMLInputElement }) as ProviderSettings[K]),
		)
	}
}

function OpenRouterApiKeyField({
	apiConfiguration,
	setApiConfigurationField,
	t,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	t: (key: string) => string
}) {
	const hasApiKey = !!apiConfiguration?.openRouterApiKey
	return (
		<VSCodeTextField
			value={safeValue(apiConfiguration?.openRouterApiKey)}
			type="password"
			onInput={handleInputChange(setApiConfigurationField, "openRouterApiKey")}
			placeholder={t("settings:placeholders.apiKey")}
			className="w-full">
			<div className="flex justify-between items-center mb-1">
				<label className="block font-medium">{t("settings:providers.openRouterApiKey")}</label>
				{hasApiKey && (
					<OpenRouterBalanceDisplay
						apiKey={apiConfiguration.openRouterApiKey as string}
						baseUrl={apiConfiguration.openRouterBaseUrl}
					/>
				)}
			</div>
		</VSCodeTextField>
	)
}

function OpenRouterGetApiKeyButton({
	apiConfiguration,
	uriScheme,
	t,
}: {
	apiConfiguration: ProviderSettings
	uriScheme: string | undefined
	t: (key: string) => string
}) {
	if (apiConfiguration?.openRouterApiKey) return null
	return (
		<VSCodeButtonLink href={getOpenRouterAuthUrl(uriScheme)} style={{ width: "100%" }} appearance="primary">
			{t("settings:providers.getOpenRouterApiKey")}
		</VSCodeButtonLink>
	)
}

function OpenRouterBaseUrlSection({
	apiConfiguration,
	setApiConfigurationField,
	simplifySettings,
	t,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	simplifySettings?: boolean
	t: (key: string) => string
}) {
	const [openRouterBaseUrlSelected, setOpenRouterBaseUrlSelected] = useState(!!apiConfiguration?.openRouterBaseUrl)

	if (simplifySettings) return null
	return (
		<div>
			<Checkbox
				checked={openRouterBaseUrlSelected}
				onChange={(checked: boolean) => {
					setOpenRouterBaseUrlSelected(checked)
					if (!checked) {
						setApiConfigurationField("openRouterBaseUrl", "")
					}
				}}>
				{t("settings:providers.useCustomBaseUrl")}
			</Checkbox>
			{openRouterBaseUrlSelected && (
				<VSCodeTextField
					value={safeValue(apiConfiguration?.openRouterBaseUrl)}
					type="url"
					onInput={handleInputChange(setApiConfigurationField, "openRouterBaseUrl")}
					placeholder="Default: https://openrouter.ai/api/v1"
					className="w-full mt-1"
				/>
			)}
		</div>
	)
}

export const OpenRouter = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	uriScheme,
	simplifySettings,
	organizationAllowList,
	modelValidationError,
}: OpenRouterProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			<OpenRouterApiKeyField
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				t={t}
			/>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			<OpenRouterGetApiKeyButton apiConfiguration={apiConfiguration} uriScheme={uriScheme} t={t} />
			<OpenRouterBaseUrlSection
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				simplifySettings={simplifySettings}
				t={t}
			/>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={openRouterDefaultModelId}
				models={routerModels?.openrouter ?? {}}
				modelIdKey="openRouterModelId"
				serviceName="OpenRouter"
				serviceUrl="https://openrouter.ai/models"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
		</>
	)
}
