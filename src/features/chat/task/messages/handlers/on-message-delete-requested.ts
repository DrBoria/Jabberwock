import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"
import { handleDeleteOperation } from "./helpers/deleteOperations"

/**
 * Handles message.delete.requested intent — shows a delete confirmation
 * dialog in the webview for the specified message.
 */
export function registerOnMessageDeleteRequested(bus: IntentBus): void {
	bus.register(IntentType.MessageDeleteRequested, async (intent, ctx) => {
		const { taskId, messageTs } = intent.payload as {
			taskId: string
			messageTs: number
		}

		const store = ctx.rootStore.chat.tasks.get(taskId)
		if (!store || !ctx.provider) return

		await handleDeleteOperation(ctx.provider, store, messageTs)
	})
}
