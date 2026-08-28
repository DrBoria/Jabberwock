import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { getCloudService } from "@jabberwock/cloud"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"

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
			backendLog.info(`Failed to update cloud settings for task sync: ${error}`)
		}
	})
}
