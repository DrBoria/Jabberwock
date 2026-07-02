import type { IntentBus } from "@features/intents/bus"
import { registerSettingsUpdates } from "./register-settings-updates"
import { registerSettingsCommands } from "./register-settings-commands"
import { registerSettingsDebug } from "./register-settings-debug"

export function registerOnSettingsCore(bus: IntentBus): void {
	registerSettingsUpdates(bus)
	registerSettingsCommands(bus)
	registerSettingsDebug(bus)
}
