import { useCallback, useEffect, useState, type FormEvent } from "react"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import {
	type ProviderSettings,
	type OrganizationAllowList,
	type RouterModels,
	type ModelRecord,
	requestyDefaultModelId,
} from "@jabberwock/types"

import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"

import { inputEventTransform } from "../../../shared/transforms"
import { ModelPicker } from "../../../ModelPicker/ModelPickerComponent"
import { RequestyBalanceDisplay } from "../../balance-displays/RequestyBalanceDisplay"
import { getCallbackUrl } from "@/oauth/urls"
import { toRequestyServiceUrl } from "@shared/utils/requesty"

type RequestyProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	uriScheme?: string
	simplifySettings?: boolean
}

function toggleEndpoint(
	e: { target: EventTarget | null },
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void,
	setRequestyEndpointSelected: (value: boolean) => void,
): void {
	const isChecked = (e.target as HTMLInputElement).checked === true
	if (!isChecked) {
		setApiConfigurationField("requestyBaseUrl", undefined)
	}
	setRequestyEndpointSelected(isChecked)
}

function getRequestyModels(routerModels: RouterModels | undefined): ModelRecord {
	return routerModels?.requesty ?? {}
}

export const Requesty = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	organizationAllowList,
	modelValidationError,
	uriScheme,
	simplifySettings,
}: RequestyProps) => {
	const { t } = useAppTranslation()

	const [requestyEndpointSelected, setRequestyEndpointSelected] = useState(!!apiConfiguration.requestyBaseUrl)

	useEffect(() => {
		setRequestyEndpointSelected(!!apiConfiguration.requestyBaseUrl)
	}, [apiConfiguration.requestyBaseUrl])

	const handleApiKeyChange = useCallback(
		(e: Event | FormEvent<HTMLElement>) => {
			setApiConfigurationField("requestyApiKey", inputEventTransform({ target: e.target as HTMLInputElement }))
		},
		[setApiConfigurationField],
	)

	const handleBaseUrlChange = useCallback(
		(e: Event | FormEvent<HTMLElement>) => {
			setApiConfigurationField("requestyBaseUrl", inputEventTransform({ target: e.target as HTMLInputElement }))
		},
		[setApiConfigurationField],
	)

	const getApiKeyUrl = () => {
		const callbackUrl = getCallbackUrl("requesty", uriScheme)
		const baseUrl = toRequestyServiceUrl(apiConfiguration.requestyBaseUrl, "app")
		const authUrl = new URL(`oauth/authorize?callback_url=${callbackUrl}`, baseUrl)
		return authUrl.toString()
	}

	const handleEndpointToggle = useCallback(
		(e: { target: EventTarget | null }) => {
			toggleEndpoint(e, setApiConfigurationField, setRequestyEndpointSelected)
		},
		[setApiConfigurationField],
	)

	const handleRefreshModels = useCallback(() => {
		rootStore.settings.requestRouterModels({ provider: "requesty", refresh: true })
	}, [])

	const requestyApiKey = apiConfiguration.requestyApiKey
	const requestyBaseUrl = apiConfiguration.requestyBaseUrl
	const hasApiKey = !!requestyApiKey
	const routerModelsRequesty = getRequestyModels(routerModels)

	return (
		<>
			<VSCodeTextField
				value={requestyApiKey || ""}
				type="password"
				onInput={handleApiKeyChange}
				placeholder={t("settings:providers.getRequestyApiKey")}
				className="w-full">
				<div className="flex justify-between items-center mb-1">
					<label className="block font-medium">{t("settings:providers.requestyApiKey")}</label>
					{hasApiKey && (
						<RequestyBalanceDisplay
							baseUrl={apiConfiguration.requestyBaseUrl}
							apiKey={requestyApiKey ?? ""}
						/>
					)}
				</div>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			<a
				href={getApiKeyUrl()}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 rounded-md px-3 w-full"
				style={{
					width: "100%",
					textDecoration: "none",
					color: "var(--vscode-button-foreground)",
					backgroundColor: "var(--vscode-button-background)",
				}}>
				{t("settings:providers.getRequestyApiKey")}
			</a>

			<VSCodeCheckbox checked={requestyEndpointSelected} onChange={handleEndpointToggle}>
				{t("settings:providers.requestyUseCustomBaseUrl")}
			</VSCodeCheckbox>
			{requestyEndpointSelected && (
				<VSCodeTextField
					value={requestyBaseUrl || ""}
					type="text"
					onInput={handleBaseUrlChange}
					placeholder={t("settings:providers.getRequestyBaseUrl")}
					className="w-full">
					<div className="flex justify-between items-center mb-1">
						<label className="block font-medium">{t("settings:providers.getRequestyBaseUrl")}</label>
					</div>
				</VSCodeTextField>
			)}
			<Button variant="outline" onClick={handleRefreshModels}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-refresh" />
					{t("settings:providers.refreshModels.label")}
				</div>
			</Button>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={requestyDefaultModelId}
				models={routerModelsRequesty}
				modelIdKey="requestyModelId"
				serviceName="Requesty"
				serviceUrl="https://requesty.ai"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
		</>
	)
}
