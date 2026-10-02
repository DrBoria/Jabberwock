import type { IntentBus } from "@features/intents"
import { registerOnSettingsOpened } from "./lifecycle/on-settings-opened"
import { registerOnSettingsChanged } from "./lifecycle/on-settings-changed"
import { registerCommands, registerDebug, registerUpdates } from "./settings-core/index"
import { registerOnSettingsApiConfig } from "./api-config/index"
import { registerOnSettingsCodeIndex } from "./code-index/main"
import { registerOnSettingsFiles } from "./settings/files"
import { registerOnSettingsMcp } from "./settings/mcp"
import { registerOnSettingsAgents } from "./agents/main"
import { registerOnSettingsModels } from "./settings/models"
import { registerOnSettingsContext } from "./settings/context"
import { registerOnSettingsVscode } from "./ui/on-settings-vscode"
import { registerOnSettingsWebview } from "./ui/on-settings-webview"
import { registerOnSettingsWorktree } from "./lifecycle/on-settings-worktree"
import { registerOnSettingsSkills } from "./ui/on-settings-skills"
import { registerOnSettingsDiagnostics } from "./lifecycle/on-diagnostics"
import { registerOnTopicModeSwitchRequested } from "./lifecycle/on-mode-switch-requested"
import { registerAllSettingsAgentsHandlers } from "@features/settings/agents/handlers"

/**
 * Register all settings-related intent handlers on the bus.
 */
export function registerAllSettingsHandlers(bus: IntentBus): void {
	registerOnSettingsOpened(bus)
	registerOnSettingsChanged(bus)
	registerCommands(bus)
	registerDebug(bus)
	registerUpdates(bus)
	registerOnSettingsApiConfig(bus)
	registerOnSettingsCodeIndex(bus)
	registerOnSettingsFiles(bus)
	registerOnSettingsMcp(bus)
	registerOnSettingsAgents(bus)
	registerOnSettingsModels(bus)
	registerOnSettingsContext(bus)
	registerOnSettingsVscode(bus)
	registerOnSettingsWebview(bus)
	registerOnSettingsWorktree(bus)
	registerOnSettingsSkills(bus)
	registerAllSettingsAgentsHandlers(bus)
	registerOnSettingsDiagnostics(bus)
	registerOnTopicModeSwitchRequested(bus)
}
