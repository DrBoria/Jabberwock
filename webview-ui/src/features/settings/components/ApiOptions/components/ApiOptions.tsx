import { memo } from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { ApiErrorMessage } from "../../provider-controls/ApiErrorMessage"
import type { ApiOptionsProps } from "../types"
import { useApiOptions } from "../useApiOptions"
import { ProviderHeaderSection } from "./ProviderHeaderSection"
import { ModelPickerSection } from "./ModelPickerSection"
import { ExtraSettingsSection } from "./ExtraSettingsSection"
import { AdvancedSettingsSection } from "./AdvancedSettingsSection"

const ApiOptions = ({
	uriScheme,
	apiConfiguration,
	setApiConfigurationField,
	fromWelcomeView,
	errorMessage,
	setErrorMessage,
}: ApiOptionsProps) => {
	const { t } = useAppTranslation()
	const {
		selectedProvider,
		selectedModelId,
		selectedModelInfo,
		activeSelectedProvider,
		isRetiredSelectedProvider,
		cloudIsAuthenticated,
		isAdvancedSettingsOpen,
		setIsAdvancedSettingsOpen,
		handleInputChange,
		modelValidationError,
		docs,
		providerOptions,
		onProviderChange,
		renderer,
		providerRenderProps,
		openRouterModelProviders,
	} = useApiOptions({
		uriScheme,
		apiConfiguration,
		setApiConfigurationField,
		fromWelcomeView,
		errorMessage,
		setErrorMessage,
	})

	const retiredMessage = (
		<div
			className="rounded-md border border-vscode-panel-border px-3 py-2 text-sm text-vscode-descriptionForeground"
			data-testid="retired-provider-message">
			{t("settings:providers.retiredProviderMessage")}
		</div>
	)

	const activeContent = (
		<>
			{renderer?.(providerRenderProps)}
			<ModelPickerSection
				activeSelectedProvider={activeSelectedProvider}
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				selectedProvider={selectedProvider || ""}
				selectedModelId={selectedModelId}
				organizationAllowList={providerRenderProps.organizationAllowList}
				modelValidationError={modelValidationError}
				fromWelcomeView={fromWelcomeView}
				t={t}
			/>
			<ExtraSettingsSection
				fromWelcomeView={fromWelcomeView}
				selectedProvider={selectedProvider}
				selectedModelId={selectedModelId}
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				selectedModelInfo={selectedModelInfo}
			/>
			<AdvancedSettingsSection
				fromWelcomeView={fromWelcomeView}
				isAdvancedSettingsOpen={isAdvancedSettingsOpen}
				setIsAdvancedSettingsOpen={setIsAdvancedSettingsOpen}
				selectedModelInfo={selectedModelInfo}
				selectedProvider={selectedProvider}
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				handleInputChange={handleInputChange}
				openRouterModelProviders={openRouterModelProviders}
				selectedModelId={selectedModelId}
				t={t}
			/>
		</>
	)

	return (
		<div className="flex flex-col gap-3">
			<ProviderHeaderSection
				t={t}
				selectedProvider={selectedProvider}
				cloudIsAuthenticated={cloudIsAuthenticated}
				docs={docs}
				providerOptions={providerOptions}
				onProviderChange={onProviderChange}
			/>
			{errorMessage && <ApiErrorMessage errorMessage={errorMessage} />}
			{isRetiredSelectedProvider ? retiredMessage : activeContent}
		</div>
	)
}

export default memo(ApiOptions)
