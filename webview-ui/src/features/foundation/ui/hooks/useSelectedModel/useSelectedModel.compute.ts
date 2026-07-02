import { isRetiredProvider, isDynamicProvider } from "@jabberwock/types"
import type { ProviderName, ProviderSettings } from "@jabberwock/types"

export interface ProviderDerivedState {
	provider: string
	activeProvider: ProviderName | undefined
	dynamicProvider: ProviderName | undefined
	openRouterModelId: string | undefined
	lmStudioModelId: string | undefined
	ollamaModelId: string | undefined
	shouldFetchRouterModels: boolean
}

export const getModelIdByProvider = (
	activeProvider: ProviderName | undefined,
	apiConfiguration: ProviderSettings | undefined,
): Pick<ProviderDerivedState, "openRouterModelId" | "lmStudioModelId" | "ollamaModelId"> => ({
	openRouterModelId: activeProvider === "openrouter" ? apiConfiguration?.openRouterModelId : undefined,
	lmStudioModelId: activeProvider === "lmstudio" ? apiConfiguration?.lmStudioModelId : undefined,
	ollamaModelId: activeProvider === "ollama" ? apiConfiguration?.ollamaModelId : undefined,
})

export const computeProviderState = (apiConfiguration: ProviderSettings | undefined): ProviderDerivedState => {
	const provider = apiConfiguration?.apiProvider || "anthropic"
	const activeProvider: ProviderName | undefined = isRetiredProvider(provider) ? undefined : provider
	const dynamicProvider = activeProvider != null && isDynamicProvider(activeProvider) ? activeProvider : undefined
	return {
		provider,
		activeProvider,
		dynamicProvider,
		shouldFetchRouterModels: !!dynamicProvider,
		...getModelIdByProvider(activeProvider, apiConfiguration),
	}
}

export interface NeedState {
	needRouterModels: boolean
	needOpenRouterProviders: boolean
	needLmStudio: boolean
	needOllama: boolean
}

export const computeNeedState = (
	shouldFetchRouterModels: boolean,
	activeProvider: ProviderName | undefined,
	lmStudioModelId: string | undefined,
	ollamaModelId: string | undefined,
): NeedState => ({
	needRouterModels: shouldFetchRouterModels,
	needOpenRouterProviders: activeProvider === "openrouter",
	needLmStudio: lmStudioModelId != null,
	needOllama: ollamaModelId != null,
})

export const computeHasValidRouterData = (
	needRouterModels: boolean,
	dynamicProvider: ProviderName | undefined,
	routerData: unknown,
	routerIsLoading: boolean,
): boolean => {
	if (!needRouterModels || !dynamicProvider) return true
	const data = routerData as Record<string, unknown> | null | undefined
	return !(
		data == null ||
		data[dynamicProvider] == null ||
		typeof data[dynamicProvider] !== "object" ||
		routerIsLoading
	)
}

export const computeIsReady = (
	needLmStudio: boolean,
	lmStudioData: unknown,
	needOllama: boolean,
	ollamaData: unknown,
	hasValidRouterData: boolean,
	needOpenRouterProviders: boolean,
	openRouterProviderData: unknown,
): boolean =>
	!(needLmStudio && lmStudioData == null) &&
	!(needOllama && ollamaData == null) &&
	hasValidRouterData &&
	!(needOpenRouterProviders && openRouterProviderData == null)

export const computeCombinedState = (
	needRouter: boolean,
	routerState: boolean,
	needOpenRouter: boolean,
	openRouterState: boolean,
	needLmStudio: boolean,
	lmStudioState: boolean,
	needOllama: boolean,
	ollamaState: boolean,
): boolean =>
	(needRouter && routerState) ||
	(needOpenRouter && openRouterState) ||
	(needLmStudio && lmStudioState) ||
	(needOllama && ollamaState)
