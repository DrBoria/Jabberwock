import { useMemo, useCallback } from "react"
import { z } from "zod"

import { rootStore } from "@src/features/store"
import { useOpenRouterModelProviders } from "@src/features/foundation/ui/hooks/useModelProviders/useOpenRouterModelProviders"
import { useEscapeKey } from "@src/hooks/escape-key/useEscapeKey"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { SECRET_PLACEHOLDER, SECRET_PLACEHOLDER_FIELDS } from "./code-index-popover-constants"
import { createValidationSchema } from "./code-index-popover-validation"
import type { LocalCodeIndexSettings } from "./code-index-popover-types"
import type { IndexingStatus, EmbedderProvider } from "@jabberwock/types"

export const useCodeIndexRouterProviders = (
	provider: EmbedderProvider,
	modelId: string | undefined,
	codebaseIndexEmbedderModelId: string | undefined,
) => {
	const isOpenRouter = provider === "openrouter"
	return useOpenRouterModelProviders(isOpenRouter ? modelId : undefined, undefined, {
		enabled: isOpenRouter && !!codebaseIndexEmbedderModelId,
	})
}

export const useCodeIndexCallbacks = (
	currentSettings: LocalCodeIndexSettings,
	initialSettings: LocalCodeIndexSettings,
	hasUnsavedChanges: boolean,
	indexingStatus: IndexingStatus,
	open: boolean,
	setOpen: (open: boolean) => void,
	confirmDialogHandler: React.MutableRefObject<(() => void) | null>,
	setDiscardDialogShow: (show: boolean) => void,
	setCurrentSettings: (
		settings: LocalCodeIndexSettings | ((prev: LocalCodeIndexSettings) => LocalCodeIndexSettings),
	) => void,
	setFormErrors: (
		errors: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
	) => void,
	setSaveStatus: (status: "idle" | "saving" | "saved" | "error") => void,
	setSaveError: (error: string | null) => void,
	updateSetting: (key: keyof LocalCodeIndexSettings, value: unknown) => void,
	apiConfiguration: { apiProvider?: string; awsRegion?: string; awsProfile?: string } | undefined,
) => {
	const { t } = useAppTranslation()

	const validateSettings = useCallback((): boolean => {
		const schema = createValidationSchema(currentSettings.codebaseIndexEmbedderProvider, t)
		const dataToValidate: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(currentSettings)) {
			dataToValidate[key] =
				value === SECRET_PLACEHOLDER && SECRET_PLACEHOLDER_FIELDS.has(key) ? "placeholder-valid" : value
		}
		try {
			schema.parse(dataToValidate)
			setFormErrors({})
			return true
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errors: Record<string, string> = {}
				error.errors.forEach((err) => {
					if (err.path[0]) errors[err.path[0] as string] = err.message
				})
				setFormErrors(errors)
			}
			return false
		}
	}, [currentSettings, t, setFormErrors])

	const checkUnsavedChanges = useCallback(
		(then: () => void) => {
			if (hasUnsavedChanges) {
				confirmDialogHandler.current = then
				setDiscardDialogShow(true)
			} else then()
		},
		[hasUnsavedChanges, confirmDialogHandler, setDiscardDialogShow],
	)

	const onConfirmDialogResult = useCallback(
		(confirm: boolean) => {
			if (confirm) {
				setCurrentSettings(initialSettings)
				setFormErrors({})
				confirmDialogHandler.current?.()
			}
			setDiscardDialogShow(false)
		},
		[initialSettings, setCurrentSettings, setFormErrors, confirmDialogHandler, setDiscardDialogShow],
	)

	const handlePopoverClose = useCallback(() => {
		checkUnsavedChanges(() => setOpen(false))
	}, [checkUnsavedChanges, setOpen])

	const handlePopoverOpenChange = useCallback(
		(newOpen: boolean) => {
			if (newOpen) setOpen(true)
			else handlePopoverClose()
		},
		[handlePopoverClose, setOpen],
	)

	useEscapeKey(open, handlePopoverClose)

	const handleProviderChange = useCallback(
		(value: EmbedderProvider) => {
			updateSetting("codebaseIndexEmbedderProvider", value)
			updateSetting("codebaseIndexEmbedderModelId", "")
			if (value === "bedrock" && apiConfiguration?.apiProvider === "bedrock") {
				if (!currentSettings.codebaseIndexBedrockRegion && apiConfiguration.awsRegion)
					updateSetting("codebaseIndexBedrockRegion", apiConfiguration.awsRegion)
				if (!currentSettings.codebaseIndexBedrockProfile && apiConfiguration.awsProfile)
					updateSetting("codebaseIndexBedrockProfile", apiConfiguration.awsProfile)
			}
		},
		[
			apiConfiguration,
			currentSettings.codebaseIndexBedrockProfile,
			currentSettings.codebaseIndexBedrockRegion,
			updateSetting,
		],
	)

	const handleSaveSettings = useCallback(() => {
		if (!validateSettings()) return
		setSaveStatus("saving")
		setSaveError(null)
		const settingsToSave: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(currentSettings)) {
			if (value !== SECRET_PLACEHOLDER) settingsToSave[key] = value
		}
		settingsToSave.codebaseIndexEnabled = currentSettings.codebaseIndexEnabled
		rootStore.settings.saveCodeIndexSettings(settingsToSave)
	}, [validateSettings, currentSettings, setSaveStatus, setSaveError])

	const getAvailableModels = useCallback(() => {
		const { codebaseIndexModels } = rootStore.extensionState
		if (!codebaseIndexModels) return []
		const models =
			codebaseIndexModels[currentSettings.codebaseIndexEmbedderProvider as keyof typeof codebaseIndexModels]
		return models ? Object.keys(models) : []
	}, [currentSettings.codebaseIndexEmbedderProvider])

	const progressPercentage = useMemo(
		() =>
			indexingStatus.totalItems > 0
				? Math.round((indexingStatus.processedItems / indexingStatus.totalItems) * 100)
				: 0,
		[indexingStatus.processedItems, indexingStatus.totalItems],
	)

	return {
		validateSettings,
		checkUnsavedChanges,
		onConfirmDialogResult,
		handlePopoverClose,
		handlePopoverOpenChange,
		handleProviderChange,
		handleSaveSettings,
		getAvailableModels,
		progressPercentage,
	}
}
