import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

import {
	handleSettingsApiConfigSave,
	handleSettingsApiConfigRename,
	handleSettingsApiConfigLoad,
	handleSettingsApiConfigLoadById,
	handleSettingsApiConfigList,
	handleSettingsApiConfigLockModes,
	handleSettingsApiConfigPinToggle,
	handleSettingsApiConfigEnhancementId,
} from "./handlers"
import { handleSettingsApiConfigUpsert } from "./upsert-config"
import { handleSettingsApiConfigDelete } from "./delete-config"

/**
 * Register all API config settings intent handlers.
 */
export function registerOnSettingsApiConfig(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigSave, handleSettingsApiConfigSave)
	bus.register(IntentType.SettingsApiConfigUpsert, handleSettingsApiConfigUpsert)
	bus.register(IntentType.SettingsApiConfigRename, handleSettingsApiConfigRename)
	bus.register(IntentType.SettingsApiConfigDelete, handleSettingsApiConfigDelete)
	bus.register(IntentType.SettingsApiConfigLoad, handleSettingsApiConfigLoad)
	bus.register(IntentType.SettingsApiConfigLoadById, handleSettingsApiConfigLoadById)
	bus.register(IntentType.SettingsApiConfigList, handleSettingsApiConfigList)
	bus.register(IntentType.SettingsApiConfigLockModes, handleSettingsApiConfigLockModes)
	bus.register(IntentType.SettingsApiConfigPinToggle, handleSettingsApiConfigPinToggle)
	bus.register(IntentType.SettingsApiConfigEnhancementId, handleSettingsApiConfigEnhancementId)
	bus.register(IntentType.SettingsApiConfigPasswordSet, async () => {})
}
