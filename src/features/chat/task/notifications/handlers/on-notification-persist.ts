import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"

/**
 * Handles notification.persist intent — persists task notifications to disk.
 * Replaces the old MobX reaction in reactions.ts.
 */
export function registerOnNotificationPersist(bus: IntentBus): void {
	bus.register(IntentType.NotificationPersist, async (intent, ctx) => {
		const { taskId } = intent.payload as { taskId: string }

		const { saveMessages } = await import("../../../task/messages/actions/persistMessages")
		await saveMessages(taskId)
	})
}
