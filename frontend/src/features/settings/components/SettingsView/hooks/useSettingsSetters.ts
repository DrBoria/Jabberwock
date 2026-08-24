import { useCallback } from "react"
import type {
	ExtensionState,
	ProviderSettings,
	ExperimentId,
	TelemetrySetting,
	ImageGenerationProvider,
} from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { areValuesEqual, isInitialSyncValue } from "../utils/utils"

export function useSettingsSetters(
	setCachedState: React.Dispatch<React.SetStateAction<ExtensionState>>,
	setChangeDetected: React.Dispatch<React.SetStateAction<boolean>>,
	prevApiConfigName: React.MutableRefObject<string>,
) {
	const setCachedStateField = useCallback(
		<K extends keyof ExtensionState>(field: K, value: ExtensionState[K]) => {
			setCachedState((prev) => {
				if (prev[field] === value) return prev
				setChangeDetected(true)
				return { ...prev, [field]: value }
			})
		},
		[setCachedState, setChangeDetected],
	)

	const setApiConfigurationField = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K], isUserAction = true) => {
			setCachedState((prev) => {
				if ((prev.apiConfiguration as ProviderSettings | undefined)?.[field] === value) return prev
				const previousValue = (prev.apiConfiguration as ProviderSettings | undefined)?.[field]
				const skipDetection =
					!isUserAction && (areValuesEqual(previousValue, value) || isInitialSyncValue(previousValue, value))
				if (!skipDetection) setChangeDetected(true)
				return {
					...prev,
					apiConfiguration: {
						...((prev.apiConfiguration as ProviderSettings | undefined) ?? {}),
						[field]: value,
					},
				}
			})
		},
		[setCachedState, setChangeDetected],
	)

	const setExperimentEnabled = useCallback(
		(id: ExperimentId, enabled: boolean) => {
			setCachedState((prev) => {
				const experiments = (prev.experiments as Record<string, boolean> | undefined) ?? {}
				if (experiments[id] === enabled) return prev
				setChangeDetected(true)
				return { ...prev, experiments: { ...experiments, [id]: enabled } }
			})
		},
		[setCachedState, setChangeDetected],
	)

	const setTelemetrySetting = useCallback(
		(setting: TelemetrySetting) => {
			setCachedState((prev) => {
				if (prev.telemetrySetting === setting) return prev
				setChangeDetected(true)
				return { ...prev, telemetrySetting: setting }
			})
		},
		[setCachedState, setChangeDetected],
	)

	const setDebug = useCallback(
		(debug: boolean) => {
			setCachedState((prev) => {
				if (prev.debug === debug) return prev
				setChangeDetected(true)
				return { ...prev, debug }
			})
		},
		[setCachedState, setChangeDetected],
	)

	const setImageGenerationProvider = useCallback(
		(provider: ImageGenerationProvider) => {
			setCachedState((prev) => {
				if (prev.imageGenerationProvider !== provider) setChangeDetected(true)
				return { ...prev, imageGenerationProvider: provider }
			})
		},
		[setCachedState, setChangeDetected],
	)

	const setOpenRouterImageApiKey = useCallback(
		(apiKey: string) => {
			setCachedState((prev) => {
				if (prev.openRouterImageApiKey !== apiKey) setChangeDetected(true)
				return { ...prev, openRouterImageApiKey: apiKey }
			})
		},
		[setCachedState, setChangeDetected],
	)

	const setImageGenerationSelectedModel = useCallback(
		(model: string) => {
			setCachedState((prev) => {
				if (prev.openRouterImageGenerationSelectedModel !== model) setChangeDetected(true)
				return { ...prev, openRouterImageGenerationSelectedModel: model }
			})
		},
		[setCachedState, setChangeDetected],
	)

	const setCustomSupportPromptsField = useCallback(
		(prompts: Record<string, string | undefined>) => {
			setCachedState((prev) => {
				if (JSON.stringify(prev.customSupportPrompts) === JSON.stringify(prompts)) return prev
				setChangeDetected(true)
				return { ...prev, customSupportPrompts: prompts }
			})
		},
		[setCachedState, setChangeDetected],
	)

	const handleRenameConfig = useCallback(
		(oldName: string, newName: string) => {
			rootStore.settings.renameApiConfig({ oldName, newName })
			prevApiConfigName.current = newName
		},
		[prevApiConfigName],
	)

	return {
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
	}
}
