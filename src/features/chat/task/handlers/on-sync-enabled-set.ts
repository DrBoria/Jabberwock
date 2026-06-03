import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { getCloudService } from "@jabberwock/cloud"
import { EventBridge } from "@features/foundation/webview/EventBridge"

/**
 * Handles task.sync.enabled.set intent — enables/disables cloud task sync.
 */
export function registerOnTaskSyncEnabledSet(bus: IntentBus): void {
	bus.register(IntentType.TaskSyncEnabledSet, async (intent, _ctx) => {
		const { enabled } = intent.payload as { enabled: boolean }
		const updatedSettings = { taskSyncEnabled: enabled }
		try {
			await getCloudService().updateUserSettings(updatedSettings)
		} catch (error: unknown) {
			EventBridge.outputChannel?.appendLine(`Failed to update cloud settings for task sync: ${error}`)
		}
	})
}
