import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"
import { handleDeleteMessageConfirm } from "./helpers/deleteOperations"

/**
 * Handles message.delete.confirmed intent — performs the actual deletion
 * after the user has confirmed through the webview dialog.
 */
export function registerOnMessageDeleteConfirmed(bus: IntentBus): void {
	bus.register(IntentType.MessageDeleteConfirmed, async (intent, ctx) => {
		const { taskId, messageTs, restoreCheckpoint } = intent.payload as {
			taskId: string
			messageTs: number
			restoreCheckpoint?: boolean
		}

		const store = ctx.rootStore.chat.tasks.get(taskId)
		if (!store || !ctx.provider) return

		await handleDeleteMessageConfirm(ctx.provider, store, messageTs, restoreCheckpoint)
	})
}
