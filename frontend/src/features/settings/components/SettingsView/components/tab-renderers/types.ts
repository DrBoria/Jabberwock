import type {
	ExtensionState,
	ProviderSettings,
	TelemetrySetting,
	ImageGenerationProvider,
	ExperimentId,
} from "@jabberwock/types"

export interface BuildTabRenderersParams {
	cachedState: ExtensionState
	apiConfiguration: ProviderSettings
	currentApiConfigName: string
	listApiConfigMeta: { id: string; name: string }[]
	uriScheme: string | undefined
	errorMessage: string | undefined
	setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>
	setCachedStateField: <K extends keyof ExtensionState>(field: K, value: ExtensionState[K]) => void
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	setExperimentEnabled: (id: ExperimentId, enabled: boolean) => void
	setTelemetrySetting: (setting: TelemetrySetting) => void
	setDebug: (debug: boolean) => void
	setImageGenerationProvider: (provider: ImageGenerationProvider) => void
	setOpenRouterImageApiKey: (apiKey: string) => void
	setImageGenerationSelectedModel: (model: string) => void
	setCustomSupportPromptsField: (prompts: Record<string, string | undefined>) => void
	checkUnsaveChanges: (then: () => void) => void
	onRenameConfig: (oldName: string, newName: string) => void
	t: (key: string) => string
}
