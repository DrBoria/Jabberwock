import { useState } from "react"
import { litellmDefaultModelId } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { ModelPicker } from "../../ModelPicker/ModelPickerComponent"
import { useLiteLLMMessageHandler } from "./useLiteLLMMessageHandler"
import {
	LiteLLMBaseUrlField,
	LiteLLMApiKeyField,
	LiteLLMRefreshButton,
	LiteLLMRefreshStatus,
	LiteLLMPromptCaching,
} from "./fields"
import type { LiteLLMProps } from "./types"

export const LiteLLM = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: LiteLLMProps) => {
	const { t } = useAppTranslation()
	const routerModels = rootStore.settings.routerModels
	const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
	const [refreshError, setRefreshError] = useState<string | undefined>()
	useLiteLLMMessageHandler(refreshStatus, setRefreshStatus, setRefreshError)

	const handleRefreshModels = () => {
		setRefreshStatus("loading")
		setRefreshError(undefined)
		const key = apiConfiguration.litellmApiKey
		const url = apiConfiguration.litellmBaseUrl
		if (!key || !url) {
			setRefreshStatus("error")
			setRefreshError(t("settings:providers.refreshModels.missingConfig"))
			return
		}
		rootStore.settings.requestRouterModels({ litellmApiKey: key, litellmBaseUrl: url })
	}

	const refreshDisabled =
		refreshStatus === "loading" || !apiConfiguration.litellmApiKey || !apiConfiguration.litellmBaseUrl

	return (
		<>
			<LiteLLMBaseUrlField
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				t={t}
			/>
			<LiteLLMApiKeyField
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				t={t}
			/>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			<LiteLLMRefreshButton
				refreshStatus={refreshStatus}
				onRefresh={handleRefreshModels}
				disabled={refreshDisabled}
				t={t}
			/>
			<LiteLLMRefreshStatus refreshStatus={refreshStatus} refreshError={refreshError} t={t} />
			<ModelPicker
				apiConfiguration={apiConfiguration}
				defaultModelId={litellmDefaultModelId}
				models={routerModels?.litellm ?? {}}
				modelIdKey="litellmModelId"
				serviceName="LiteLLM"
				serviceUrl="https://docs.litellm.ai/"
				setApiConfigurationField={setApiConfigurationField}
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
			<LiteLLMPromptCaching
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				routerModels={routerModels}
				t={t}
			/>
		</>
	)
}
