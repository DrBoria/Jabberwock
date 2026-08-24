import type { OrganizationAllowList, ProviderName, ProviderSettings } from "@jabberwock/types"
import { filterModels } from "../../utils/organizationFilters"
import { MODELS_BY_PROVIDER } from "../../shared/constants"
import { PROVIDER_MODEL_CONFIG, getZaiDefaultModelId } from "../constants"
import type { ProviderModelConfig } from "../types"

export function getProviderModelConfig(
	provider: ProviderName,
	apiConfiguration: ProviderSettings,
): ProviderModelConfig | undefined {
	if (provider === "zai") {
		return { field: "apiModelId", default: getZaiDefaultModelId(apiConfiguration) }
	}
	return PROVIDER_MODEL_CONFIG[provider]
}

function validateAndResetModel(
	provider: ProviderName,
	modelId: string | undefined,
	field: keyof ProviderSettings,
	defaultValue: string | undefined,
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void,
	organizationAllowList: OrganizationAllowList,
): void {
	if (!defaultValue) return
	if (!modelId) {
		setApiConfigurationField(field, defaultValue, false)
		return
	}
	const staticModels = MODELS_BY_PROVIDER[provider]
	if (!staticModels) return
	if (provider === "bedrock" && modelId === "custom-arn") return
	const filteredModels = filterModels(staticModels, provider, organizationAllowList)
	const isValidModel = !!filteredModels && Object.prototype.hasOwnProperty.call(filteredModels, modelId)
	if (!isValidModel) setApiConfigurationField(field, defaultValue, false)
}

export function handleProviderChange(
	value: ProviderName,
	apiConfiguration: ProviderSettings,
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void,
	organizationAllowList: OrganizationAllowList,
): void {
	setApiConfigurationField("apiProvider", value)
	const config = getProviderModelConfig(value, apiConfiguration)
	if (config) {
		validateAndResetModel(
			value,
			apiConfiguration[config.field] as string | undefined,
			config.field,
			config.default,
			setApiConfigurationField,
			organizationAllowList,
		)
	}
}
