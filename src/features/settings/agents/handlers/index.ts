import type { IntentBus } from "../../../intents/bus"
import { registerOnModesFileChanged } from "./on-modes-file-changed"
import { handleCodeAction } from "./on-code-action"
import { handleTerminalAction } from "./on-terminal-action"

/**
 * Register all settings/agents intent handlers on the bus.
 */
export function registerAllSettingsAgentsHandlers(bus: IntentBus): void {
	registerOnModesFileChanged(bus)
}

export { handleCodeAction, handleTerminalAction }
