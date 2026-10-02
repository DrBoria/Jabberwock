import { useEffect, useMemo, useRef, useState } from "react"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { SectionName } from "@src/features/settings/components/SettingsView/constants"
import { buildSettingsPayload } from "@src/features/settings/components/SettingsView/utils"
import { useSettingsNavigation } from "./use-navigation"
import { useSettingsSearchIndex } from "./use-search-index"
import { useSettingsSetters } from "./use-setters"

function getSectionLabel(t: (key: string) => string): (section: SectionName) => string {
	return (section: SectionName) => t(`settings:sidebar.${section}`)
}

export function useSettingsState(_onDone: () => void, targetSection?: string) {
	const { t } = useAppTranslation()
	const s = rootStore.extensionState
	const currentApiConfigName = s.currentApiConfigName
	const listApiConfigMeta = s.listApiConfigMeta
	const uriScheme = s.uriScheme
	const settingsImportedAt = s.settingsImportedAt

	const {
		activeTab,
		setActiveTab,
		contentRef,
		tabRefs,
		isCompactMode,
		containerRef,
		sections,
		handleTabChange,
		containerClass,
	} = useSettingsNavigation(targetSection)

	const [isDiscardDialogShow, setDiscardDialogShow] = useState(false)
	const [isChangeDetected, setChangeDetected] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [cachedState, setCachedState] = useState(() => s)
	const telemetrySetting = cachedState.telemetrySetting
	const apiConfiguration = useMemo(() => cachedState.apiConfiguration ?? {}, [cachedState.apiConfiguration])

	const prevApiConfigName = useRef(currentApiConfigName)
	const prevApiConfiguration = useRef(s.apiConfiguration)
	const prevSettingsImportedAt = useRef(settingsImportedAt)
	const confirmDialogHandler = useRef<() => void>()
	const extensionStateRef = useRef(s)
	useEffect(() => {
		extensionStateRef.current = s
	}, [s])

	// Mirror isChangeDetected into a ref so the re-sync effect below can tell
	// "the user is mid-edit" apart from "a" routine backend broadcast.
	const changeDetectedRef = useRef(isChangeDetected)
	useEffect(() => {
		changeDetectedRef.current = isChangeDetected
	}, [isChangeDetected])

	useEffect(() => {
		const apiConfigChanged = prevApiConfiguration.current !== s.apiConfiguration
		if (prevApiConfigName.current === currentApiConfigName && !apiConfigChanged) return
		// A backend re-broadcast (webview launch sync, profile reload, any settings
		// push) arrives with a fresh apiConfiguration reference. If the user has
		// unsaved edits, merging the live store over cachedState here would clobber
		// those edits AND reset isChangeDetected, leaving the Save button disabled
		// even though fields visibly changed (the "provider registration doesn't
		// work" symptom). Skip the clobber while unsaved edits are in flight.
		if (changeDetectedRef.current) {
			prevApiConfigName.current = currentApiConfigName
			prevApiConfiguration.current = s.apiConfiguration
			return
		}
		setCachedState((prev) => ({ ...prev, ...extensionStateRef.current }))
		prevApiConfigName.current = currentApiConfigName
		prevApiConfiguration.current = s.apiConfiguration
		setChangeDetected(false)
	}, [currentApiConfigName, s.apiConfiguration])

	useEffect(() => {
		if (settingsImportedAt && prevSettingsImportedAt.current !== settingsImportedAt) {
			setCachedState((prev) => ({ ...prev, ...s }))
			setChangeDetected(false)
			prevSettingsImportedAt.current = settingsImportedAt
		}
	}, [settingsImportedAt, s])

	const {
		registerSetting,
		index: searchIndex,
		isIndexing,
		renderTab,
		handleSearchNavigate,
		tabContentClass,
	} = useSettingsSearchIndex(getSectionLabel(t), activeTab, setActiveTab, handleTabChange)

	const {
		setCachedStateField,
		setApiConfigurationField,
		setExperimentEnabled,
		setTelemetrySetting,
		setDebug,
		setImageGenerationProvider,
		setOpenRouterImageApiKey,
		setImageGenerationSelectedModel,
		setCustomSupportPromptsField,
		handleRenameConfig,
	} = useSettingsSetters(setCachedState, setChangeDetected, prevApiConfigName as React.MutableRefObject<string>)

	const handleSubmit = () => {
		rootStore.settings.updateSettings(buildSettingsPayload(cachedState))
		setChangeDetected(false)
	}

	const checkUnsaveChanges = (then: () => void) => {
		if (isChangeDetected) {
			confirmDialogHandler.current = then
			setDiscardDialogShow(true)
		} else {
			then()
		}
	}

	const onConfirmDialogResult = (confirmed: boolean) => {
		if (confirmed) {
			setCachedState(() => ({ ...s }))
			setChangeDetected(false)
			confirmDialogHandler.current?.()
		}
		setDiscardDialogShow(false)
		confirmDialogHandler.current = undefined
	}

	const saveButtonTooltip = errorMessage ?? t("settings:header.saveButtonTooltip")

	return {
		t,
		isDiscardDialogShow,
		setDiscardDialogShow,
		errorMessage,
		setErrorMessage,
		isChangeDetected,
		activeTab,
		cachedState,
		apiConfiguration,
		currentApiConfigName,
		listApiConfigMeta,
		uriScheme,
		telemetrySetting,
		isCompactMode,
		sections,
		renderTab,
		registerSetting,
		searchIndex,
		setCachedStateField,
		setApiConfigurationField,
		setExperimentEnabled,
		setTelemetrySetting,
		setDebug,
		setImageGenerationProvider,
		setOpenRouterImageApiKey,
		setImageGenerationSelectedModel,
		setCustomSupportPromptsField,
		handleRenameConfig,
		handleSubmit,
		checkUnsaveChanges,
		onConfirmDialogResult,
		handleTabChange,
		handleSearchNavigate,
		tabRefs,
		contentRef,
		containerRef,
		isIndexing,
		saveButtonTooltip,
		containerClass,
		tabContentClass,
	}
}
