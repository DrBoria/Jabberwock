import type { IntentBus } from "../../intents/bus"
import { registerOnSettingsOpened } from "./on-settings-opened"
import { registerOnSettingsChanged } from "./on-settings-changed"
import { registerOnSettingsCore } from "./on-settings-core"
import { registerOnSettingsApiConfig } from "./on-settings-api-config"
import { registerOnSettingsCodeIndex } from "./on-settings-code-index"
import { registerOnSettingsFiles } from "./on-settings-files"
import { registerOnSettingsMcp } from "./on-settings-mcp"
import { registerOnSettingsAgents } from "./on-settings-agents"
import { registerOnSettingsModels } from "./on-settings-models"
import { registerOnSettingsContext } from "./on-settings-context"
import { registerOnSettingsVscode } from "./on-settings-vscode"
import { registerOnSettingsWebview } from "./on-settings-webview"
import { registerOnSettingsWorktree } from "./on-settings-worktree"
import { registerOnSettingsSkills } from "./on-settings-skills"
import { registerOnSettingsDiagnostics } from "./on-diagnostics"
import { registerOnTopicModeSwitchRequested } from "./on-mode-switch-requested"
import { registerAllSettingsAgentsHandlers } from "../agents/handlers"

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
