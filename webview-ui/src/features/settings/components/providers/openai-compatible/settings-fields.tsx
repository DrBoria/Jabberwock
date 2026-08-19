import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import type { ProviderSettings } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { OpenAICompatibleProps } from "./types"
import { getEventValue } from "./types"

export const ConnectionSettings = ({
	apiConfiguration,
	setApiConfigurationField,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: OpenAICompatibleProps["setApiConfigurationField"]
}) => {
	const { t } = useAppTranslation()
	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.openAiBaseUrl ?? ""}
				type="url"
				onInput={(e) => setApiConfigurationField("openAiBaseUrl", getEventValue(e))}
				placeholder={t("settings:placeholders.baseUrl")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.openAiBaseUrl")}</label>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.openAiApiKey ?? ""}
				type="password"
				onInput={(e) => setApiConfigurationField("openAiApiKey", getEventValue(e))}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.apiKey")}</label>
			</VSCodeTextField>
		</>
	)
}

export const BooleanSettings = ({
	apiConfiguration,
	setApiConfigurationField,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: OpenAICompatibleProps["setApiConfigurationField"]
}) => {
	const { t } = useAppTranslation()
	return (
		<>
			<Checkbox
				checked={apiConfiguration?.openAiStreamingEnabled ?? true}
				onChange={(c: boolean) => setApiConfigurationField("openAiStreamingEnabled", c)}>
				{t("settings:modelInfo.enableStreaming")}
			</Checkbox>
			<div>
				<Checkbox
					checked={apiConfiguration?.includeMaxTokens ?? true}
					onChange={(c: boolean) => setApiConfigurationField("includeMaxTokens", c)}>
					{t("settings:includeMaxOutputTokens")}
				</Checkbox>
				<div className="text-sm text-vscode-descriptionForeground ml-6">
					{t("settings:includeMaxOutputTokensDescription")}
				</div>
			</div>
			<Checkbox
				checked={apiConfiguration?.openAiUseAzure ?? false}
				onChange={(c: boolean) => setApiConfigurationField("openAiUseAzure", c)}>
				{t("settings:modelInfo.useAzure")}
			</Checkbox>
		</>
	)
}
