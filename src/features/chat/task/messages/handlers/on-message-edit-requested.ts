import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { handleEditOperation } from "./helpers/editOperations"

/**
 * Handles message.edit.requested intent — shows an edit confirmation
 * dialog in the webview for the specified message.
 */
export function registerOnMessageEditRequested(bus: IntentBus): void {
	bus.register(IntentType.MessageEditRequested, async (intent, ctx) => {
		const { taskId, messageTs, text, images } = intent.payload as {
			taskId: string
			messageTs: number
			text: string
			images?: string[]
		}

		const store = ctx.rootStore.chat.tasks.get(taskId)
		if (!store || !ctx.provider) return

		await handleEditOperation(ctx.provider, store, messageTs, text, images)
	})
}
