import { useState, useCallback, useEffect } from "react"
import { useEvent } from "react-use"
import type { ExtensionMessage, ModelInfo } from "@jabberwock/types"
import { openAiModelInfoSaneDefaults } from "@jabberwock/types"
import { convertHeadersToObject } from "../../utils/headers"
import { ModelPicker } from "../../ModelPicker/ModelPickerComponent"
import { R1FormatSetting } from "../../provider-controls/R1FormatSetting"
import type { OpenAICompatibleProps } from "./types"
import { ConnectionSettings, BooleanSettings } from "./settings-fields"
import { AzureApiVersionSection, CustomHeadersSection, ReasoningEffortSection } from "./sections"
import { ModelCapabilitiesSection } from "./model-sections"

export const OpenAICompatible = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: OpenAICompatibleProps) => {
	const [azureApiVersionSelected, setAzureApiVersionSelected] = useState(!!apiConfiguration?.azureApiVersion)
	const [openAiModels, setOpenAiModels] = useState<Record<string, ModelInfo> | null>(null)
	const [customHeaders, setCustomHeaders] = useState<[string, string][]>(() =>
		Object.entries(apiConfiguration?.openAiHeaders || {}),
	)
	const handleAddCustomHeader = useCallback(() => setCustomHeaders((p) => [...p, ["", ""]]), [])
	const handleUpdateHeaderKey = useCallback(
		(i: number, k: string) =>
			setCustomHeaders((p) => {
				const u = [...p]
				if (u[i]) u[i] = [k, u[i][1]]
				return u
			}),
		[],
	)
	const handleUpdateHeaderValue = useCallback(
		(i: number, v: string) =>
			setCustomHeaders((p) => {
				const u = [...p]
				if (u[i]) u[i] = [u[i][0], v]
				return u
			}),
		[],
	)
	const handleRemoveCustomHeader = useCallback(
		(i: number) => setCustomHeaders((p) => p.filter((_, idx) => idx !== i)),
		[],
	)
	useEffect(() => {
		const timer = setTimeout(
			() => setApiConfigurationField("openAiHeaders", convertHeadersToObject(customHeaders), false),
			300,
		)
		return () => clearTimeout(timer)
	}, [customHeaders, setApiConfigurationField])
	const onMessage = useCallback((event: MessageEvent) => {
		const msg: ExtensionMessage = event.data
		if (msg.type === "openAiModels")
			setOpenAiModels(
				Object.fromEntries((msg.openAiModels ?? []).map((item: string) => [item, openAiModelInfoSaneDefaults])),
			)
	}, [])
	useEvent("message", onMessage)
	return (
		<>
			<ConnectionSettings
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
			/>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId="gpt-4o"
				models={openAiModels}
				modelIdKey="openAiModelId"
				serviceName="OpenAI"
				serviceUrl="https://platform.openai.com"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
			<R1FormatSetting
				onChange={(c: boolean) => setApiConfigurationField("openAiR1FormatEnabled", c)}
				openAiR1FormatEnabled={apiConfiguration?.openAiR1FormatEnabled ?? false}
			/>
			<BooleanSettings apiConfiguration={apiConfiguration} setApiConfigurationField={setApiConfigurationField} />
			<AzureApiVersionSection
				apiConfiguration={apiConfiguration}
				azureApiVersionSelected={azureApiVersionSelected}
				setAzureApiVersionSelected={setAzureApiVersionSelected}
				setApiConfigurationField={setApiConfigurationField}
			/>
			<CustomHeadersSection
				customHeaders={customHeaders}
				handleAddCustomHeader={handleAddCustomHeader}
				handleUpdateHeaderKey={handleUpdateHeaderKey}
				handleUpdateHeaderValue={handleUpdateHeaderValue}
				handleRemoveCustomHeader={handleRemoveCustomHeader}
			/>
			<ReasoningEffortSection
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
			/>
			<ModelCapabilitiesSection
				apiConfiguration={{ openAiCustomModelInfo: apiConfiguration?.openAiCustomModelInfo ?? undefined }}
				setApiConfigurationField={setApiConfigurationField}
			/>
		</>
	)
}
