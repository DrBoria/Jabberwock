import { type ProviderSettings, getProviderDefaultModelId } from "@jabberwock/types"
import { useRouterModels } from "@src/features/foundation/ui/hooks/useModelProviders/main"
import { useOpenRouterModelProviders } from "@src/features/foundation/ui/hooks/useModelProviders/openrouter"
import { useLmStudioModels } from "@src/features/foundation/ui/hooks/useModelProviders/lmstudio"
import { useOllamaModels } from "@src/features/foundation/ui/hooks/useModelProviders/ollama"
import {
	computeProviderState,
	computeNeedState,
	computeHasValidRouterData,
	computeIsReady,
	computeCombinedState,
} from "./compute"
import { getSelectedModel } from "./selectors"
import type { SelectorParams } from "./selectors"

export const useSelectedModel = (apiConfiguration?: ProviderSettings) => {
	const {
		provider,
		activeProvider,
		dynamicProvider,
		openRouterModelId,
		lmStudioModelId,
		ollamaModelId,
		shouldFetchRouterModels,
	} = computeProviderState(apiConfiguration)
	const routerModels = useRouterModels({ provider: dynamicProvider, enabled: shouldFetchRouterModels })
	const openRouterModelProviders = useOpenRouterModelProviders(openRouterModelId)
	const lmStudioModels = useLmStudioModels(lmStudioModelId)
	const ollamaModels = useOllamaModels(ollamaModelId)
	const { needRouterModels, needOpenRouterProviders, needLmStudio, needOllama } = computeNeedState(
		shouldFetchRouterModels,
		activeProvider,
		lmStudioModelId,
		ollamaModelId,
	)
	const hasValidRouterData = computeHasValidRouterData(
		needRouterModels,
		dynamicProvider,
		routerModels.data,
		routerModels.isLoading,
	)
	const isReady = computeIsReady(
		needLmStudio,
		lmStudioModels.data,
		needOllama,
		ollamaModels.data,
		hasValidRouterData,
		needOpenRouterProviders,
		openRouterModelProviders.data,
	)
	const { id, info } =
		apiConfiguration && isReady && activeProvider
			? getSelectedModel({
					provider: activeProvider,
					apiConfiguration,
					routerModels: (routerModels.data || {}) as SelectorParams["routerModels"],
					openRouterModelProviders: (openRouterModelProviders.data ||
						{}) as SelectorParams["openRouterModelProviders"],
					lmStudioModels: (lmStudioModels.data || undefined) as SelectorParams["lmStudioModels"],
					ollamaModels: (ollamaModels.data || undefined) as SelectorParams["ollamaModels"],
					defaultModelId: getProviderDefaultModelId(activeProvider),
				})
			: { id: getProviderDefaultModelId(activeProvider ?? "anthropic"), info: undefined }
	return {
		provider,
		id,
		info,
		isLoading: computeCombinedState(
			needRouterModels,
			routerModels.isLoading,
			needOpenRouterProviders,
			openRouterModelProviders.isLoading,
			needLmStudio,
			lmStudioModels.isLoading,
			needOllama,
			ollamaModels.isLoading,
		),
		isError: computeCombinedState(
			needRouterModels,
			routerModels.isError,
			needOpenRouterProviders,
			openRouterModelProviders.isError,
			needLmStudio,
			lmStudioModels.isError,
			needOllama,
			ollamaModels.isError,
		),
	}
}
