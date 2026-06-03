import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"

/**
 * Handles notification.persist intent — persists task notifications to disk.
 * Replaces the old MobX reaction in reactions.ts.
 */
import { saveMessages } from "@features/chat/task/messages/actions/persistMessages"

export function registerOnNotificationPersist(bus: IntentBus): void {
	bus.register(IntentType.NotificationPersist, async (intent, ctx) => {
		const { taskId } = intent.payload as { taskId: string }

		await saveMessages(taskId)
	})
}
