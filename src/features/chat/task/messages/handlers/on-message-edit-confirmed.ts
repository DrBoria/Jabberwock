import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"
import { handleEditMessageConfirm } from "./helpers/editOperations"

/**
 * Handles message.edit.confirmed intent — performs the actual edit
 * after the user has confirmed through the webview dialog.
 */
export function registerOnMessageEditConfirmed(bus: IntentBus): void {
	bus.register(IntentType.MessageEditConfirmed, async (intent, ctx) => {
		const { taskId, messageTs, text, restoreCheckpoint, images } = intent.payload as {
			taskId: string
			messageTs: number
			text: string
			restoreCheckpoint?: boolean
			images?: string[]
		}

		const store = ctx.rootStore.chat.tasks.get(taskId)
		if (!store || !ctx.provider) return

		await handleEditMessageConfirm(ctx.provider, store, messageTs, text, restoreCheckpoint, images)
	})
}
