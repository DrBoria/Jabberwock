import type { ProviderSettings, ModelInfo, OrganizationAllowList, ProviderName } from "@jabberwock/types"
import { isRetiredProvider } from "@jabberwock/types"
import { filterModels } from "../utils/organizationFilters"
import type { ModelIdKey } from "./types"

export const getActiveProvider = (apiConfiguration: ProviderSettings): string | undefined =>
	apiConfiguration.apiProvider && isRetiredProvider(apiConfiguration.apiProvider)
		? undefined
		: apiConfiguration.apiProvider

export const getDisplayValue = (
	displayTransform: ((value: unknown) => string) | undefined,
	apiConfiguration: ProviderSettings,
	modelIdKey: ModelIdKey,
	selectedModelId: string | undefined,
): string | undefined =>
	displayTransform
		? apiConfiguration[modelIdKey]
			? displayTransform(apiConfiguration[modelIdKey])
			: undefined
		: selectedModelId

export const getModelIds = (
	models: Record<string, ModelInfo> | null,
	activeProvider: string | undefined,
	organizationAllowList: OrganizationAllowList | undefined,
	selectedModelId: string | undefined,
): string[] =>
	Object.keys(
		Object.entries(filterModels(models, activeProvider as ProviderName | undefined, organizationAllowList) ?? {})
			.filter(([modelId, modelInfo]) => modelId === selectedModelId || !modelInfo.deprecated)
			.reduce(
				(acc, [modelId, modelInfo]) => {
					acc[modelId] = modelInfo
					return acc
				},
				{} as Record<string, ModelInfo>,
			),
	).sort((a, b) => a.localeCompare(b))

export const cleanupTimeout = (ref: React.MutableRefObject<NodeJS.Timeout | null>): void => {
	if (ref.current) clearTimeout(ref.current)
}
