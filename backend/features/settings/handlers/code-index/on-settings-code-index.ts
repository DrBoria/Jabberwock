import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { handleSaveSettings } from "./on-settings-code-index.save-handler"
import {
	handleRequestStatus,
	handleSecretStatus,
	handleStartIndexing,
	handleStopIndexing,
	handleToggleWorkspaceIndexing,
	handleAutoEnableDefault,
	handleClearIndexData,
} from "./on-settings-code-index.handlers"

export function registerOnSettingsCodeIndex(bus: IntentBus): void {
	bus.register(IntentType.SettingsCodeIndexSave, handleSaveSettings)
	bus.register(IntentType.SettingsCodeIndexStatus, handleRequestStatus)
	bus.register(IntentType.SettingsCodeIndexSecretStatus, handleSecretStatus)
	bus.register(IntentType.SettingsCodeIndexStart, handleStartIndexing)
	bus.register(IntentType.SettingsCodeIndexStop, handleStopIndexing)
	bus.register(IntentType.SettingsCodeIndexWorkspaceToggle, handleToggleWorkspaceIndexing)
	bus.register(IntentType.SettingsCodeIndexAutoEnable, handleAutoEnableDefault)
	bus.register(IntentType.SettingsCodeIndexClear, handleClearIndexData)
}
