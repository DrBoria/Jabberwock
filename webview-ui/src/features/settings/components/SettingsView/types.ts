import type { LucideIcon } from "lucide-react"
import type { ProviderSettings, TelemetrySetting, ImageGenerationProvider } from "@jabberwock/types"
import type { ExtensionState } from "@jabberwock/types"
import type { SectionName } from "./constants"
import type { SetCachedStateField, SetExperimentEnabled } from "../shared/types"

export interface TabSidebarProps {
	sections: { id: SectionName; icon: LucideIcon }[]
	activeTab: SectionName
	isCompactMode: boolean
	onTabChange: (id: SectionName) => void
	tabRefs: React.MutableRefObject<Record<SectionName, HTMLButtonElement | null>>
	t: (key: string) => string
}

export interface TabContentProps {
	renderTab: SectionName
	cachedState: ExtensionState
	apiConfiguration: ProviderSettings
	currentApiConfigName: string
	listApiConfigMeta: { id: string; name: string }[]
	uriScheme: string | undefined
	errorMessage: string | undefined
	setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>
	setCachedStateField: SetCachedStateField<keyof ExtensionState>
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	setExperimentEnabled: SetExperimentEnabled
	setTelemetrySetting: (setting: TelemetrySetting) => void
	setDebug: (debug: boolean) => void
	setImageGenerationProvider: (provider: ImageGenerationProvider) => void
	setOpenRouterImageApiKey: (apiKey: string) => void
	setImageGenerationSelectedModel: (model: string) => void
	setCustomSupportPromptsField: (prompts: Record<string, string | undefined>) => void
	checkUnsaveChanges: (then: () => void) => void
	onRenameConfig: (oldName: string, newName: string) => void
}

export interface SettingsViewRef {
	checkUnsaveChanges: (then: () => void) => void
}

export interface SettingsViewProps {
	onDone: () => void
	targetSection?: string
}
