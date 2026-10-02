import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { handleSaveSettings } from "./save-handler"
import {
	handleRequestStatus,
	handleSecretStatus,
	handleStartIndexing,
	handleStopIndexing,
	handleToggleWorkspaceIndexing,
	handleAutoEnableDefault,
	handleClearIndexData,
} from "./status-handlers"

function registerOnSettingsCodeIndexSettingsCodeIndexSave(bus: IntentBus): void {
	bus.register(IntentType.SettingsCodeIndexSave, handleSaveSettings)
}

function registerOnSettingsCodeIndexSettingsCodeIndexStatus(bus: IntentBus): void {
	bus.register(IntentType.SettingsCodeIndexStatus, handleRequestStatus)
}

function registerOnSettingsCodeIndexSettingsCodeIndexSecretStatus(bus: IntentBus): void {
	bus.register(IntentType.SettingsCodeIndexSecretStatus, handleSecretStatus)
}

function registerOnSettingsCodeIndexSettingsCodeIndexStart(bus: IntentBus): void {
	bus.register(IntentType.SettingsCodeIndexStart, handleStartIndexing)
}

function registerOnSettingsCodeIndexSettingsCodeIndexStop(bus: IntentBus): void {
	bus.register(IntentType.SettingsCodeIndexStop, handleStopIndexing)
}

function registerOnSettingsCodeIndexSettingsCodeIndexWorkspaceToggle(bus: IntentBus): void {
	bus.register(IntentType.SettingsCodeIndexWorkspaceToggle, handleToggleWorkspaceIndexing)
}

function registerOnSettingsCodeIndexSettingsCodeIndexAutoEnable(bus: IntentBus): void {
	bus.register(IntentType.SettingsCodeIndexAutoEnable, handleAutoEnableDefault)
}

function registerOnSettingsCodeIndexSettingsCodeIndexClear(bus: IntentBus): void {
	bus.register(IntentType.SettingsCodeIndexClear, handleClearIndexData)
}

export function registerOnSettingsCodeIndex(_bus: IntentBus): void {
	registerOnSettingsCodeIndexSettingsCodeIndexSave(_bus)
	registerOnSettingsCodeIndexSettingsCodeIndexStatus(_bus)
	registerOnSettingsCodeIndexSettingsCodeIndexSecretStatus(_bus)
	registerOnSettingsCodeIndexSettingsCodeIndexStart(_bus)
	registerOnSettingsCodeIndexSettingsCodeIndexStop(_bus)
	registerOnSettingsCodeIndexSettingsCodeIndexWorkspaceToggle(_bus)
	registerOnSettingsCodeIndexSettingsCodeIndexAutoEnable(_bus)
	registerOnSettingsCodeIndexSettingsCodeIndexClear(_bus)
}
