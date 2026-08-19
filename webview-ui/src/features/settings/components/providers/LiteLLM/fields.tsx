import { VSCodeTextField, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { litellmDefaultModelId } from "@jabberwock/types"
import { Button } from "@src/shared/ui/buttons/button"
import { safeValue, handleInputChange } from "./helpers"
import type {
	LiteLLMFieldProps,
	LiteLLMRefreshButtonProps,
	LiteLLMRefreshStatusProps,
	LiteLLMPromptCachingProps,
} from "./types"

export const LiteLLMBaseUrlField = ({ apiConfiguration, setApiConfigurationField, t }: LiteLLMFieldProps) => (
	<VSCodeTextField
		value={safeValue(apiConfiguration?.litellmBaseUrl)}
		onInput={handleInputChange(setApiConfigurationField, "litellmBaseUrl")}
		placeholder={t("settings:placeholders.baseUrl")}
		className="w-full">
		<label className="block font-medium mb-1">{t("settings:providers.litellmBaseUrl")}</label>
	</VSCodeTextField>
)

export const LiteLLMApiKeyField = ({ apiConfiguration, setApiConfigurationField, t }: LiteLLMFieldProps) => (
	<VSCodeTextField
		value={safeValue(apiConfiguration?.litellmApiKey)}
		type="password"
		onInput={handleInputChange(setApiConfigurationField, "litellmApiKey")}
		placeholder={t("settings:placeholders.apiKey")}
		className="w-full">
		<label className="block font-medium mb-1">{t("settings:providers.litellmApiKey")}</label>
	</VSCodeTextField>
)

export const LiteLLMRefreshButton = ({ refreshStatus, onRefresh, disabled, t }: LiteLLMRefreshButtonProps) => (
	<Button variant="outline" onClick={onRefresh} disabled={disabled} className="w-full">
		<div className="flex items-center gap-2">
			{refreshStatus === "loading" ? (
				<span className="codicon codicon-loading codicon-modifier-spin" />
			) : (
				<span className="codicon codicon-refresh" />
			)}
			{t("settings:providers.refreshModels.label")}
		</div>
	</Button>
)

export const LiteLLMRefreshStatus = ({ refreshStatus, refreshError, t }: LiteLLMRefreshStatusProps) => {
	if (refreshStatus === "loading")
		return (
			<div className="text-sm text-vscode-descriptionForeground">
				{t("settings:providers.refreshModels.loading")}
			</div>
		)
	if (refreshStatus === "success")
		return <div className="text-sm text-vscode-foreground">{t("settings:providers.refreshModels.success")}</div>
	if (refreshStatus === "error")
		return (
			<div className="text-sm text-vscode-errorForeground">
				{refreshError || t("settings:providers.refreshModels.error")}
			</div>
		)
	return null
}

export const LiteLLMPromptCaching = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	t,
}: LiteLLMPromptCachingProps) => {
	const selectedModelId = apiConfiguration.litellmModelId || litellmDefaultModelId
	if (!routerModels?.litellm?.[selectedModelId]?.supportsPromptCache) return null
	return (
		<div className="mt-4">
			<VSCodeCheckbox
				checked={apiConfiguration.litellmUsePromptCache || false}
				onChange={(e) =>
					setApiConfigurationField("litellmUsePromptCache", (e.target as HTMLInputElement).checked)
				}>
				<span className="font-medium">{t("settings:providers.enablePromptCaching")}</span>
			</VSCodeCheckbox>
			<div className="text-sm text-vscode-descriptionForeground ml-6 mt-1">
				{t("settings:providers.enablePromptCachingTitle")}
			</div>
		</div>
	)
}
