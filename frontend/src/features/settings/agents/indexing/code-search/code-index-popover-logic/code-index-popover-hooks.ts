import { useState, useEffect, useMemo, useCallback, useRef } from "react"

import { rootStore } from "@src/features/store"

import { SECRET_PLACEHOLDER, updateWithSecrets, buildInitialSettings } from "./code-index-popover-constants"
import type { SecretStatus } from "./code-index-popover-constants"
import type { LocalCodeIndexSettings } from "./code-index-popover-types"
import type { IndexingStatus } from "@jabberwock/types"
import { CODEBASE_INDEX_DEFAULTS } from "@jabberwock/types"

const defaultSettings: LocalCodeIndexSettings = {
	codebaseIndexEnabled: true,
	codebaseIndexQdrantUrl: "",
	codebaseIndexEmbedderProvider: "openai",
	codebaseIndexEmbedderBaseUrl: "",
	codebaseIndexEmbedderModelId: "",
	codebaseIndexEmbedderModelDimension: undefined,
	codebaseIndexSearchMaxResults: CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS,
	codebaseIndexSearchMinScore: CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE,
	codebaseIndexBedrockRegion: "",
	codebaseIndexBedrockProfile: "",
	codeIndexOpenAiKey: "",
	codeIndexQdrantApiKey: "",
	codebaseIndexOpenAiCompatibleBaseUrl: "",
	codebaseIndexOpenAiCompatibleApiKey: "",
	codebaseIndexGeminiApiKey: "",
	codebaseIndexMistralApiKey: "",
	codebaseIndexVercelAiGatewayApiKey: "",
	codebaseIndexOpenRouterApiKey: "",
	codebaseIndexOpenRouterSpecificProvider: "",
}

export const useCodeIndexState = (externalIndexingStatus: IndexingStatus) => {
	const { codebaseIndexConfig, codebaseIndexModels, cwd, apiConfiguration } = rootStore.extensionState
	const [open, setOpen] = useState(false)
	const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false)
	const [isSetupSettingsOpen, setIsSetupSettingsOpen] = useState(false)
	const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>(externalIndexingStatus)
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
	const [saveError, setSaveError] = useState<string | null>(null)
	const [formErrors, setFormErrors] = useState<Record<string, string>>({})
	const [isDiscardDialogShow, setDiscardDialogShow] = useState(false)
	const confirmDialogHandler = useRef<(() => void) | null>(null)
	const [initialSettings, setInitialSettings] = useState<LocalCodeIndexSettings>(defaultSettings)
	const [currentSettings, setCurrentSettings] = useState<LocalCodeIndexSettings>(defaultSettings)

	useEffect(() => {
		setIndexingStatus(externalIndexingStatus)
	}, [externalIndexingStatus])

	useEffect(() => {
		if (codebaseIndexConfig) {
			const settings = buildInitialSettings(codebaseIndexConfig)
			setInitialSettings(settings)
			setCurrentSettings(settings)
			rootStore.settings.requestCodeIndexSecretStatus()
		}
	}, [codebaseIndexConfig])

	useEffect(() => {
		if (open) {
			rootStore.settings.requestIndexingStatus()
			rootStore.settings.requestCodeIndexSecretStatus()
		}
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "workspaceUpdated" && open) {
				rootStore.settings.requestIndexingStatus()
				rootStore.settings.requestCodeIndexSecretStatus()
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [open])

	const currentSettingsRef = useRef(currentSettings)
	currentSettingsRef.current = currentSettings

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "indexingStatusUpdate") {
				if (!event.data.values.workspacePath || event.data.values.workspacePath === cwd)
					setIndexingStatus({
						systemStatus: event.data.values.systemStatus,
						message: event.data.values.message || "",
						processedItems: event.data.values.processedItems,
						totalItems: event.data.values.totalItems,
						currentItemUnit: event.data.values.currentItemUnit || "items",
					})
			} else if (event.data.type === "codeIndexSettingsSaved") {
				if (event.data.success) {
					setSaveStatus("saved")
					const savedSettings = { ...currentSettingsRef.current }
					setInitialSettings(savedSettings)
					setCurrentSettings(savedSettings)
					rootStore.settings.requestCodeIndexSecretStatus()
					setSaveStatus("idle")
				} else {
					setSaveStatus("error")
					setSaveError(event.data.error || "")
					setSaveStatus("idle")
					setSaveError(null)
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [cwd])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "codeIndexSecretStatus") {
				const secretStatus: SecretStatus = event.data.values
				if (saveStatus === "idle" || saveStatus === "saved") {
					setCurrentSettings((prev) => updateWithSecrets(prev, secretStatus))
					setInitialSettings((prev) => updateWithSecrets(prev, secretStatus))
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [saveStatus])

	const hasUnsavedChanges = useMemo(() => {
		const allKeys = Array.from(
			new Set([...Object.keys(initialSettings), ...Object.keys(currentSettings)]),
		) as (keyof LocalCodeIndexSettings)[]
		return allKeys.some(
			(key) => currentSettings[key] !== SECRET_PLACEHOLDER && currentSettings[key] !== initialSettings[key],
		)
	}, [currentSettings, initialSettings])

	const updateSetting = useCallback((key: keyof LocalCodeIndexSettings, value: unknown) => {
		setCurrentSettings((prev) => ({ ...prev, [key]: value }))
		setFormErrors((prev) => {
			if (!(key in prev)) return prev
			const { [key]: _, ...rest } = prev
			return rest
		})
	}, [])

	return {
		open,
		setOpen,
		isAdvancedSettingsOpen,
		setIsAdvancedSettingsOpen,
		isSetupSettingsOpen,
		setIsSetupSettingsOpen,
		indexingStatus,
		saveStatus,
		setSaveStatus,
		saveError,
		setSaveError,
		formErrors,
		setFormErrors,
		isDiscardDialogShow,
		setDiscardDialogShow,
		confirmDialogHandler,
		initialSettings,
		setInitialSettings,
		currentSettings,
		setCurrentSettings,
		hasUnsavedChanges,
		updateSetting,
		codebaseIndexModels,
		apiConfiguration,
	}
}
