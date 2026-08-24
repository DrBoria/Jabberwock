import { useCallback, useState, useEffect } from "react"
import { Checkbox } from "vscrui"
import {
	type ProviderSettings,
	BEDROCK_1M_CONTEXT_MODEL_IDS,
	BEDROCK_GLOBAL_INFERENCE_MODEL_IDS,
	BEDROCK_SERVICE_TIER_MODEL_IDS,
} from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { inputEventTransform } from "../../shared/transforms"
import type { BedrockProps } from "./types"
import { AuthMethodSelect, AuthFields } from "./auth"
import { RegionSelect } from "./regions"
import {
	ServiceTierSection,
	GlobalInferenceCheckbox,
	PromptCacheSection,
	OneMContextBetaSection,
	VpcEndpointSection,
} from "./sections"

export const Bedrock = ({ apiConfiguration, setApiConfigurationField, selectedModelInfo }: BedrockProps) => {
	const { t } = useAppTranslation()
	const [awsEndpointSelected, setAwsEndpointSelected] = useState(!!apiConfiguration?.awsBedrockEndpointEnabled)
	const modelId = apiConfiguration?.apiModelId
	const supports1MContextBeta = !!modelId && (BEDROCK_1M_CONTEXT_MODEL_IDS as readonly string[]).includes(modelId)
	const supportsGlobalInference =
		!!modelId && (BEDROCK_GLOBAL_INFERENCE_MODEL_IDS as readonly string[]).includes(modelId)
	const supportsServiceTiers = !!modelId && (BEDROCK_SERVICE_TIER_MODEL_IDS as readonly string[]).includes(modelId)
	useEffect(() => {
		setAwsEndpointSelected(!!apiConfiguration?.awsBedrockEndpointEnabled)
	}, [apiConfiguration?.awsBedrockEndpointEnabled])
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
	return (
		<>
			<AuthMethodSelect apiConfiguration={apiConfiguration} setApiConfigurationField={setApiConfigurationField} />
			<div className="text-sm text-vscode-descriptionForeground -mt-3">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			<AuthFields apiConfiguration={apiConfiguration} handleInputChange={handleInputChange} />
			<RegionSelect apiConfiguration={apiConfiguration} setApiConfigurationField={setApiConfigurationField} />
			<ServiceTierSection
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				supportsServiceTiers={supportsServiceTiers}
			/>
			{supportsGlobalInference && (
				<GlobalInferenceCheckbox
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
				/>
			)}
			<Checkbox
				checked={apiConfiguration?.awsUseCrossRegionInference || false}
				onChange={(checked: boolean) => setApiConfigurationField("awsUseCrossRegionInference", checked)}>
				{t("settings:providers.awsCrossRegion")}
			</Checkbox>
			<PromptCacheSection
				apiConfiguration={apiConfiguration}
				selectedModelInfo={selectedModelInfo}
				handleInputChange={handleInputChange}
			/>
			<OneMContextBetaSection
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				supports1MContextBeta={supports1MContextBeta}
			/>
			<VpcEndpointSection
				apiConfiguration={apiConfiguration}
				handleInputChange={handleInputChange}
				awsEndpointSelected={awsEndpointSelected}
				setAwsEndpointSelected={setAwsEndpointSelected}
				setApiConfigurationField={setApiConfigurationField}
			/>
		</>
	)
}
