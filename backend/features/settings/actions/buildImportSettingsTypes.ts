import type { ProviderSettingsManager } from "@features/settings/models/provider-settings-manager"
import type { SettingsAccess } from "@utils/settings"

export type ImportOptions = {
	providerSettingsManager: ProviderSettingsManager
	contextProxy: SettingsAccess
}

export type ImportWithProviderOptions = ImportOptions & {
	provider: import("@features/foundation").ProviderHandle
}
