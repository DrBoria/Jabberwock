import {
	getDefaultModelIdForProvider,
	getStaticModelsForProvider,
	shouldUseGenericModelPicker,
	handleModelChangeSideEffects,
	getProviderServiceConfig,
} from "@src/features/settings/components/utils/providerModelConfig"
import { ModelPicker } from "@src/features/settings/components/ModelPicker/main"
import { BedrockCustomArn } from "@src/features/settings/components/providers/bedrock/custom-arn"
import type { ModelPickerSectionProps } from "@src/features/settings/components/ApiOptions/types"

export const ModelPickerSection = ({
	activeSelectedProvider,
	apiConfiguration,
	setApiConfigurationField,
	selectedProvider,
	selectedModelId,
	organizationAllowList,
	modelValidationError,
	fromWelcomeView,
	t,
}: ModelPickerSectionProps) => {
	if (!activeSelectedProvider) return null
	if (!shouldUseGenericModelPicker(activeSelectedProvider)) return null
	return (
		<>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={getDefaultModelIdForProvider(activeSelectedProvider, apiConfiguration)}
				models={getStaticModelsForProvider(activeSelectedProvider, t("settings:labels.useCustomArn"))}
				modelIdKey="apiModelId"
				serviceName={getProviderServiceConfig(activeSelectedProvider).serviceName}
				serviceUrl={getProviderServiceConfig(activeSelectedProvider).serviceUrl}
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={fromWelcomeView}
				onModelChange={(modelId) =>
					handleModelChangeSideEffects(activeSelectedProvider, modelId, setApiConfigurationField)
				}
			/>
			{selectedProvider === "bedrock" && selectedModelId === "custom-arn" && (
				<BedrockCustomArn
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
				/>
			)}
		</>
	)
}
