import i18next from "i18next"

import {
	type ProviderSettings,
	type OrganizationAllowList,
	type ProviderName,
	type RouterModels,
	modelIdKeysByProvider,
	isProviderName,
	isRetiredProvider,
	isDynamicProvider,
	isFauxProvider,
	isCustomProvider,
} from "@jabberwock/types"

import { validators } from "../misc/provider-validators"

export function validateApiConfiguration(
	apiConfiguration: ProviderSettings,
	routerModels?: RouterModels,
	organizationAllowList?: OrganizationAllowList,
): string | undefined {
	const keysAndIdsPresentErrorMessage = validateModelsAndKeysProvided(apiConfiguration)
	if (keysAndIdsPresentErrorMessage) return keysAndIdsPresentErrorMessage
	const organizationAllowListError = validateProviderAgainstOrganizationSettings(
		apiConfiguration,
		organizationAllowList,
	)
	if (organizationAllowListError) return organizationAllowListError.message
	return validateDynamicProviderModelId(apiConfiguration, routerModels)
}

function validateModelsAndKeysProvided(apiConfiguration: ProviderSettings): string | undefined {
	const provider = apiConfiguration.apiProvider
	if (!provider) return undefined
	const validator = validators[provider]
	return validator ? validator(apiConfiguration) : undefined
}

type ValidationError = { message: string; code: "PROVIDER_NOT_ALLOWED" | "MODEL_NOT_ALLOWED" }

function isModelNotAllowedForProvider(
	apiConfiguration: ProviderSettings,
	provider: string,
	providerConfig: { allowAll: boolean; models?: string[] },
): boolean {
	if (providerConfig.allowAll) return false
	const activeProvider = isRetiredProvider(provider) ? undefined : provider
	if (!activeProvider) return false
	const modelId = getModelIdForProvider(apiConfiguration, activeProvider as ProviderName)
	if (!modelId) return false
	const allowedModels = providerConfig.models ?? []
	return !allowedModels.includes(modelId)
}

function validateProviderAgainstOrganizationSettings(
	apiConfiguration: ProviderSettings,
	organizationAllowList?: OrganizationAllowList,
): ValidationError | undefined {
	if (!organizationAllowList || organizationAllowList.allowAll) return undefined
	const provider = apiConfiguration.apiProvider
	if (!provider) return undefined
	const providerConfig = organizationAllowList.providers[provider]
	if (!providerConfig)
		return {
			message: i18next.t("settings:validation.providerNotAllowed", { provider }),
			code: "PROVIDER_NOT_ALLOWED",
		}
	if (isModelNotAllowedForProvider(apiConfiguration, provider, providerConfig))
		return {
			message: i18next.t("settings:validation.modelNotAllowed", {
				model: getModelIdForProvider(apiConfiguration, provider as ProviderName),
				provider,
			}),
			code: "MODEL_NOT_ALLOWED",
		}
	return undefined
}

function getModelIdForProvider(apiConfiguration: ProviderSettings, provider: ProviderName): string | undefined {
	if (provider === "vscode-lm") return apiConfiguration.vsCodeLmModelSelector?.id
	if (isCustomProvider(provider) || isFauxProvider(provider)) return apiConfiguration.apiModelId
	return apiConfiguration[modelIdKeysByProvider[provider]]
}

export function validateBedrockArn(arn: string, region?: string) {
	const regionMatch = arn.match(/^arn:[^:]+:[^:]+:([^:]+):/)
	const arnRegion = regionMatch?.[1]
	if (region && arnRegion && arnRegion !== region)
		return {
			isValid: true,
			arnRegion,
			errorMessage: i18next.t("settings:validation.arn.regionMismatch", { arnRegion, region }),
		}
	return { isValid: true, arnRegion, errorMessage: undefined }
}

function validateDynamicProviderModelId(
	apiConfiguration: ProviderSettings,
	routerModels?: RouterModels,
): string | undefined {
	const provider = apiConfiguration.apiProvider ?? ""
	if (!isDynamicProvider(provider)) return undefined
	const modelId = getModelIdForProvider(apiConfiguration, provider)
	if (!modelId) return i18next.t("settings:validation.modelId")
	const models = routerModels?.[provider]
	if (models && Object.keys(models).length > 1 && !Object.keys(models).includes(modelId))
		return i18next.t("settings:validation.modelAvailability", { modelId })
	return undefined
}

export function getModelValidationError(
	apiConfiguration: ProviderSettings,
	routerModels?: RouterModels,
	organizationAllowList?: OrganizationAllowList,
): string | undefined {
	const modelId = isProviderName(apiConfiguration.apiProvider)
		? getModelIdForProvider(apiConfiguration, apiConfiguration.apiProvider)
		: apiConfiguration.apiModelId
	const configWithModelId = { ...apiConfiguration, apiModelId: modelId || "" }
	const orgError = validateProviderAgainstOrganizationSettings(configWithModelId, organizationAllowList)
	if (orgError && orgError.code === "MODEL_NOT_ALLOWED") return orgError.message
	return validateDynamicProviderModelId(configWithModelId, routerModels)
}

export function validateApiConfigurationExcludingModelErrors(
	apiConfiguration: ProviderSettings,
	_routerModels?: RouterModels,
	organizationAllowList?: OrganizationAllowList,
): string | undefined {
	const keysAndIdsPresentErrorMessage = validateModelsAndKeysProvided(apiConfiguration)
	if (keysAndIdsPresentErrorMessage) return keysAndIdsPresentErrorMessage
	const organizationAllowListError = validateProviderAgainstOrganizationSettings(
		apiConfiguration,
		organizationAllowList,
	)
	if (organizationAllowListError && organizationAllowListError.code === "PROVIDER_NOT_ALLOWED")
		return organizationAllowListError.message
	return undefined
}
