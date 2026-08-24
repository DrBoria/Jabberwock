import type { IntentBus } from "@features/intents/bus"
import { registerAllSettingsHandlers } from "@features/settings/handlers"
import { registerSettingsCoreUiHandlers } from "@features/settings/events/handlers/groups/core/settings-core-ui"
import { registerSettingsCoreDebugHandlers } from "@features/settings/events/handlers/groups/core/settings-core-debug"
import { registerSettingsFilesHandlers } from "@features/settings/events/handlers/groups/core/settings-files"
import { registerVscodeSettingsHandlers } from "@features/settings/events/handlers/groups/core/vscode-settings"
import { registerSettingsMcpHandlers } from "@features/settings/events/handlers/groups/providers/settings-mcp"
import { registerApiConfigHandlers } from "@features/settings/events/handlers/groups/providers/api-config"
import { registerModesHandlers } from "@features/settings/events/handlers/groups/providers/modes"
import { registerModelsHandlers } from "@features/settings/events/handlers/groups/providers/models"
import { registerDiagnosticsHandlers } from "@features/settings/events/handlers/groups/features/diagnostics"
import { registerCodeIndexHandlers } from "@features/settings/events/handlers/groups/features/code-index"
import { registerPromptsHandlers } from "@features/settings/events/handlers/groups/features/prompts"
import { registerWorktreesHandlers } from "@features/settings/events/handlers/groups/features/worktrees"

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
