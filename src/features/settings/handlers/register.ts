import type { IntentBus } from "@features/intents/bus"
import { registerOnSettingsOpened } from "./lifecycle/on-settings-opened"
import { registerOnSettingsChanged } from "./lifecycle/on-settings-changed"
import { registerOnSettingsCore } from "./on-settings-core"
import { registerOnSettingsApiConfig } from "./on-settings-api-config"
import { registerOnSettingsCodeIndex } from "./code-index/on-settings-code-index"
import { registerOnSettingsFiles } from "./settings/on-settings-files"
import { registerOnSettingsMcp } from "./settings/on-settings-mcp"
import { registerOnSettingsAgents } from "./agents/on-settings-agents"
import { registerOnSettingsModels } from "./settings/on-settings-models"
import { registerOnSettingsContext } from "./settings/on-settings-context"
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
	registerOnSettingsCore(bus)
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
