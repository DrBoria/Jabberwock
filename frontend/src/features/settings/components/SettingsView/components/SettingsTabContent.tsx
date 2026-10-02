import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildTabRenderers } from "./tab-renderers/build"
import type { TabContentProps } from "@src/features/settings/components/SettingsView/types"

export function SettingsTabContent(props: TabContentProps) {
	const { t } = useAppTranslation()
	const {
		renderTab,
		cachedState,
		apiConfiguration,
		currentApiConfigName,
		listApiConfigMeta,
		uriScheme,
		errorMessage,
		setErrorMessage,
		setCachedStateField,
		setApiConfigurationField,
		setExperimentEnabled,
		setTelemetrySetting,
		setDebug,
		setImageGenerationProvider,
		setOpenRouterImageApiKey,
		setImageGenerationSelectedModel,
		setCustomSupportPromptsField,
		checkUnsaveChanges,
		onRenameConfig,
	} = props
	const renderer = buildTabRenderers({
		cachedState,
		apiConfiguration,
		currentApiConfigName,
		listApiConfigMeta,
		uriScheme,
		errorMessage,
		setErrorMessage,
		setCachedStateField,
		setApiConfigurationField,
		setExperimentEnabled,
		setTelemetrySetting,
		setDebug,
		setImageGenerationProvider,
		setOpenRouterImageApiKey,
		setImageGenerationSelectedModel,
		setCustomSupportPromptsField,
		checkUnsaveChanges,
		onRenameConfig,
		t,
	})[renderTab]

	return renderer?.()
}
