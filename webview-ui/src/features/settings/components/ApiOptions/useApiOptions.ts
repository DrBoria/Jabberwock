import { useCallback, useEffect, useMemo, useState } from "react"
import { useDebounce } from "react-use"
import type { ProviderName, ProviderSettings } from "@jabberwock/types"
import { isRetiredProvider } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { getModelValidationError } from "@src/utils/helpers/validate"
import { useRouterModels } from "@src/features/foundation/ui/hooks/useModelProviders/useRouterModels"
import { useSelectedModel } from "@src/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"
import { useOpenRouterModelProviders } from "@src/features/foundation/ui/hooks/useModelProviders/useOpenRouterModelProviders"
import type { ApiOptionsProps, ProviderRenderProps } from "./types"
import { handleProviderChange } from "./utils/providerConfig"
import { getProviderOptions } from "./utils/providerOptions"
import { handleDebouncedHeadersChange, syncCustomHeaders } from "./utils/headers"
import { syncModelIdEffect } from "./utils/sync"
import { requestModelsForSelectedProvider } from "./utils/requests"
import { validateAndSetError } from "./utils/validation"
import { getDocLinkForProvider } from "./utils/docLinks"
import { providerRenderers } from "./providerRenderers"

export const useApiOptions = ({
	uriScheme,
	apiConfiguration,
	setApiConfigurationField,
	fromWelcomeView,
	setErrorMessage,
}: ApiOptionsProps) => {
	const organizationAllowList = rootStore.settings.organizationAllowList
	const cloudIsAuthenticated = rootStore.cloud.cloudIsAuthenticated
	const openAiCodexIsAuthenticated = rootStore.extensionState.openAiCodexIsAuthenticated
	const { openAiHeaders } = apiConfiguration

	const [customHeaders, setCustomHeaders] = useState<[string, string][]>(() => Object.entries(openAiHeaders || {}))

	useEffect(() => {
		syncCustomHeaders(apiConfiguration, customHeaders, setCustomHeaders)
	}, [openAiHeaders, customHeaders, apiConfiguration])

	useDebounce(
		() => {
			handleDebouncedHeadersChange(apiConfiguration, customHeaders, setApiConfigurationField)
		},
		300,
		[customHeaders, openAiHeaders, setApiConfigurationField],
	)

	const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false)

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(field: K, transform?: (event: E) => ProviderSettings[K]) =>
			(event: E | Event) => {
				setApiConfigurationField(
					field,
					transform
						? transform(event as E)
						: ((event as { target: HTMLInputElement }).target.value as ProviderSettings[K]),
				)
			},
		[setApiConfigurationField],
	)

	const {
		provider: selectedProvider,
		id: selectedModelId,
		info: selectedModelInfo,
	} = useSelectedModel(apiConfiguration)

	const activeSelectedProvider = isRetiredProvider(selectedProvider) ? undefined : (selectedProvider as ProviderName)

	const isRetiredSelectedProvider =
		typeof apiConfiguration.apiProvider === "string" && isRetiredProvider(apiConfiguration.apiProvider)

	const { data: routerModels, refetch: refetchRouterModels } = useRouterModels()

	const routerModelsEnabled = useMemo(
		() =>
			!!apiConfiguration?.openRouterModelId &&
			!!routerModels?.openrouter &&
			Object.keys(routerModels.openrouter).length > 1 &&
			apiConfiguration.openRouterModelId in routerModels.openrouter,
		[apiConfiguration?.openRouterModelId, routerModels],
	)

	const { data: openRouterModelProviders } = useOpenRouterModelProviders(
		apiConfiguration.openRouterModelId,
		apiConfiguration.openRouterBaseUrl,
		{ enabled: routerModelsEnabled },
	)

	useEffect(() => {
		syncModelIdEffect(
			isRetiredSelectedProvider,
			selectedModelId,
			apiConfiguration.apiModelId,
			setApiConfigurationField,
		)
	}, [selectedModelId, setApiConfigurationField, apiConfiguration.apiModelId, isRetiredSelectedProvider])

	useDebounce(
		() => {
			requestModelsForSelectedProvider(selectedProvider, apiConfiguration, customHeaders)
		},
		250,
		[
			selectedProvider,
			apiConfiguration.requestyApiKey,
			apiConfiguration.openAiBaseUrl,
			apiConfiguration.openAiApiKey,
			apiConfiguration.ollamaBaseUrl,
			apiConfiguration.lmStudioBaseUrl,
			apiConfiguration.litellmBaseUrl,
			apiConfiguration.litellmApiKey,
			customHeaders,
		],
	)

	useEffect(() => {
		validateAndSetError(
			isRetiredSelectedProvider,
			apiConfiguration,
			routerModels,
			organizationAllowList,
			setErrorMessage,
		)
	}, [apiConfiguration, routerModels, organizationAllowList, setErrorMessage, isRetiredSelectedProvider])

	const onProviderChange = useCallback(
		(value: ProviderName) => {
			handleProviderChange(value, apiConfiguration, setApiConfigurationField, organizationAllowList)
		},
		[setApiConfigurationField, apiConfiguration, organizationAllowList],
	)

	const modelValidationError = useMemo(
		() => getModelValidationError(apiConfiguration, routerModels, organizationAllowList),
		[apiConfiguration, routerModels, organizationAllowList],
	)

	const docs = useMemo(() => getDocLinkForProvider(selectedProvider), [selectedProvider])

	const providerOptions = useMemo(
		() => getProviderOptions(organizationAllowList, apiConfiguration.apiProvider, fromWelcomeView),
		[organizationAllowList, apiConfiguration.apiProvider, fromWelcomeView],
	)

	const renderer = selectedProvider ? providerRenderers[selectedProvider as ProviderName] : undefined

	const providerRenderProps: ProviderRenderProps = {
		apiConfiguration,
		setApiConfigurationField,
		routerModels,
		selectedModelId,
		uriScheme,
		simplifySettings: fromWelcomeView,
		organizationAllowList,
		modelValidationError,
		refetchRouterModels,
		selectedModelInfo,
		openAiCodexIsAuthenticated,
		cloudIsAuthenticated,
	}

	return {
		selectedProvider,
		selectedModelId,
		selectedModelInfo,
		activeSelectedProvider,
		isRetiredSelectedProvider,
		organizationAllowList,
		cloudIsAuthenticated,
		openAiCodexIsAuthenticated,
		isAdvancedSettingsOpen,
		setIsAdvancedSettingsOpen,
		handleInputChange,
		customHeaders,
		routerModels,
		modelValidationError,
		docs,
		providerOptions,
		onProviderChange,
		renderer,
		providerRenderProps,
		openRouterModelProviders,
	}
}
