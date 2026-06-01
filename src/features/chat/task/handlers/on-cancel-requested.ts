import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { postStateToWebview } from "../../../foundation/window-manager/store"

/**
 * Handles task.cancel.requested intent — cancels the active task.
 */
export function registerOnTaskCancelRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskCancelRequested, async (_intent, ctx) => {
		const provider = ctx.provider

		if (!provider) {
			return
		}

		ctx.rootStore.chat.activeTask?.abortTask?.()
		await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })

		ctx.rootStore.foundation.windowManager.clearPendingPushTimers()
		ctx.rootStore.chat.setIsRunning(false)

		await postStateToWebview(provider, {
			messages: [],
			currentTaskItem: undefined,
			isRunning: false,
		} as { [key: string]: unknown })
	})
}
