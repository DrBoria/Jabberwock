import type { IntentBus } from "@features/intents"
import { registerAllSettingsHandlers } from "@features/settings/handlers"
import { registerSettingsCoreUiHandlers } from "@features/settings"
import { registerSettingsCoreDebugHandlers } from "@features/settings"
import { registerSettingsFilesHandlers } from "@features/settings"
import { registerVscodeSettingsHandlers } from "@features/settings"
import { registerSettingsMcpHandlers } from "@features/settings"
import { registerApiConfigHandlers } from "@features/settings"
import { registerModesHandlers } from "@features/settings"
import { registerModelsHandlers } from "@features/settings"
import { registerDiagnosticsHandlers } from "@features/settings"
import { registerCodeIndexHandlers } from "@features/settings"
import { registerPromptsHandlers } from "@features/settings"
import { registerWorktreesHandlers } from "@features/settings"

/**
 * Register all settings-related event handlers on the given IntentBus.
 *
 * Delegates to the existing registerAllSettingsHandlers in the handlers/
 * directory and all group-specific handler registrations.
 */
export function registerOnSettingsIntents(bus: IntentBus): void {
	registerAllSettingsHandlers(bus)

	registerSettingsCoreUiHandlers(bus)
	registerSettingsCoreDebugHandlers(bus)
	registerSettingsFilesHandlers(bus)
	registerSettingsMcpHandlers(bus)
	registerDiagnosticsHandlers(bus)
	registerApiConfigHandlers(bus)
	registerCodeIndexHandlers(bus)
	registerModesHandlers(bus)
	registerModelsHandlers(bus)
	registerPromptsHandlers(bus)
	registerVscodeSettingsHandlers(bus)
	registerWorktreesHandlers(bus)
}
