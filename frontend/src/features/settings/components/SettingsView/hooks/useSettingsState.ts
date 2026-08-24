import { useEffect, useMemo, useRef, useState } from "react"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { SectionName } from "../constants"
import { buildSettingsPayload } from "../utils/utils"
import { useSettingsNavigation } from "./useSettingsNavigation"
import { useSettingsSearchIndex } from "./useSettingsSearchIndex"
import { useSettingsSetters } from "./useSettingsSetters"

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

	useEffect(() => {
		const apiConfigChanged = prevApiConfiguration.current !== s.apiConfiguration
		if (prevApiConfigName.current === currentApiConfigName && !apiConfigChanged) return
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
