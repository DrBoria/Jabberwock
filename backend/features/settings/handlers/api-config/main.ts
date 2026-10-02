import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
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

function registerOnSettingsApiConfigSettingsApiConfigSave(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigSave, handleSettingsApiConfigSave)
}

function registerOnSettingsApiConfigSettingsApiConfigUpsert(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigUpsert, handleSettingsApiConfigUpsert)
}

function registerOnSettingsApiConfigSettingsApiConfigRename(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigRename, handleSettingsApiConfigRename)
}

function registerOnSettingsApiConfigSettingsApiConfigDelete(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigDelete, handleSettingsApiConfigDelete)
}

function registerOnSettingsApiConfigSettingsApiConfigLoad(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigLoad, handleSettingsApiConfigLoad)
}

function registerOnSettingsApiConfigSettingsApiConfigLoadById(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigLoadById, handleSettingsApiConfigLoadById)
}

function registerOnSettingsApiConfigSettingsApiConfigList(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigList, handleSettingsApiConfigList)
}

function registerOnSettingsApiConfigSettingsApiConfigLockModes(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigLockModes, handleSettingsApiConfigLockModes)
}

function registerOnSettingsApiConfigSettingsApiConfigPinToggle(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigPinToggle, handleSettingsApiConfigPinToggle)
}

function registerOnSettingsApiConfigSettingsApiConfigEnhancementId(bus: IntentBus): void {
	bus.register(IntentType.SettingsApiConfigEnhancementId, handleSettingsApiConfigEnhancementId)
}

export function registerOnSettingsApiConfig(_bus: IntentBus): void {
	registerOnSettingsApiConfigSettingsApiConfigSave(_bus)
	registerOnSettingsApiConfigSettingsApiConfigUpsert(_bus)
	registerOnSettingsApiConfigSettingsApiConfigRename(_bus)
	registerOnSettingsApiConfigSettingsApiConfigDelete(_bus)
	registerOnSettingsApiConfigSettingsApiConfigLoad(_bus)
	registerOnSettingsApiConfigSettingsApiConfigLoadById(_bus)
	registerOnSettingsApiConfigSettingsApiConfigList(_bus)
	registerOnSettingsApiConfigSettingsApiConfigLockModes(_bus)
	registerOnSettingsApiConfigSettingsApiConfigPinToggle(_bus)
	registerOnSettingsApiConfigSettingsApiConfigEnhancementId(_bus)
}
