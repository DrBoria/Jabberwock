import { useCallback } from "react"
import { Checkbox } from "vscrui"
import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import type { ProviderSettings, ReasoningEffort } from "@jabberwock/types"
import { azureOpenAiDefaultApiVersion, openAiModelInfoSaneDefaults } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import type { OpenAICompatibleProps, CustomHeaderEntry } from "./types"
import { getEventValue } from "./types"
import { ThinkingBudget } from "../../ThinkingBudget/components/ThinkingBudgetComponent"

export const AzureApiVersionSection = ({
	apiConfiguration,
	azureApiVersionSelected,
	setAzureApiVersionSelected,
	setApiConfigurationField,
}: {
	apiConfiguration: ProviderSettings
	azureApiVersionSelected: boolean
	setAzureApiVersionSelected: (c: boolean) => void
	setApiConfigurationField: OpenAICompatibleProps["setApiConfigurationField"]
}) => {
	const { t } = useAppTranslation()
	const handleAzureCheckboxChange = useCallback(
		(checked: boolean) => {
			setAzureApiVersionSelected(checked)
			if (!checked) setApiConfigurationField("azureApiVersion", "")
		},
		[setAzureApiVersionSelected, setApiConfigurationField],
	)
	return (
		<div>
			<Checkbox checked={azureApiVersionSelected} onChange={handleAzureCheckboxChange}>
				{t("settings:modelInfo.azureApiVersion")}
			</Checkbox>
			{azureApiVersionSelected && (
				<VSCodeTextField
					value={apiConfiguration.azureApiVersion ?? ""}
					onInput={(e) => setApiConfigurationField("azureApiVersion", getEventValue(e))}
					placeholder={`Default: ${azureOpenAiDefaultApiVersion}`}
					className="w-full mt-1"
				/>
			)}
		</div>
	)
}

export const CustomHeadersSection = ({
	customHeaders,
	handleAddCustomHeader,
	handleUpdateHeaderKey,
	handleUpdateHeaderValue,
	handleRemoveCustomHeader,
}: {
	customHeaders: CustomHeaderEntry[]
	handleAddCustomHeader: () => void
	handleUpdateHeaderKey: (i: number, k: string) => void
	handleUpdateHeaderValue: (i: number, v: string) => void
	handleRemoveCustomHeader: (i: number) => void
}) => {
	const { t } = useAppTranslation()
	return (
		<div className="mb-4">
			<div className="flex justify-between items-center mb-2">
				<label className="block font-medium">{t("settings:providers.customHeaders")}</label>
				<StandardTooltip content={t("settings:common.add")}>
					<VSCodeButton appearance="icon" onClick={handleAddCustomHeader}>
						<span className="codicon codicon-add" />
					</VSCodeButton>
				</StandardTooltip>
			</div>
			{!customHeaders.length ? (
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.noCustomHeaders")}
				</div>
			) : (
				customHeaders.map(([key, value], index) => (
					<div key={index} className="flex items-center mb-2">
						<VSCodeTextField
							value={key}
							className="flex-1 mr-2"
							placeholder={t("settings:providers.headerName")}
							onInput={(e) => handleUpdateHeaderKey(index, getEventValue(e))}
						/>
						<VSCodeTextField
							value={value}
							className="flex-1 mr-2"
							placeholder={t("settings:providers.headerValue")}
							onInput={(e) => handleUpdateHeaderValue(index, getEventValue(e))}
						/>
						<StandardTooltip content={t("settings:common.remove")}>
							<VSCodeButton appearance="icon" onClick={() => handleRemoveCustomHeader(index)}>
								<span className="codicon codicon-trash" />
							</VSCodeButton>
						</StandardTooltip>
					</div>
				))
			)}
		</div>
	)
}

export const ReasoningEffortSection = ({
	apiConfiguration,
	setApiConfigurationField,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: OpenAICompatibleProps["setApiConfigurationField"]
}) => {
	const { t } = useAppTranslation()
	const handleReasoningEffortChange = useCallback(
		(checked: boolean) => {
			setApiConfigurationField("enableReasoningEffort", checked)
			if (!checked) {
				const { reasoningEffort: _, ...rest } =
					apiConfiguration.openAiCustomModelInfo || openAiModelInfoSaneDefaults
				setApiConfigurationField("openAiCustomModelInfo", rest)
			}
		},
		[setApiConfigurationField, apiConfiguration.openAiCustomModelInfo],
	)
	return (
		<div className="flex flex-col gap-1">
			<Checkbox checked={apiConfiguration.enableReasoningEffort ?? false} onChange={handleReasoningEffortChange}>
				{t("settings:providers.setReasoningLevel")}
			</Checkbox>
			{!!apiConfiguration.enableReasoningEffort && (
				<ThinkingBudget
					apiConfiguration={{
						...apiConfiguration,
						reasoningEffort: apiConfiguration.openAiCustomModelInfo?.reasoningEffort,
					}}
					setApiConfigurationField={(field, value) => {
						if (field === "reasoningEffort") {
							const info = apiConfiguration.openAiCustomModelInfo || openAiModelInfoSaneDefaults
							setApiConfigurationField("openAiCustomModelInfo", {
								...info,
								reasoningEffort: value as ReasoningEffort,
							})
						}
					}}
					modelInfo={{
						...(apiConfiguration.openAiCustomModelInfo || openAiModelInfoSaneDefaults),
						supportsReasoningEffort: ["low", "medium", "high", "xhigh"],
					}}
				/>
			)}
		</div>
	)
}
