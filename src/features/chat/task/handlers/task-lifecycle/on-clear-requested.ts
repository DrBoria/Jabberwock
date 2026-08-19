import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { postStateToWebview } from "@features/foundation/window-manager/store"

/**
 * Handles task.clear.requested intent — clears the active task.
 */
export function registerOnTaskClearRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskClearRequested, async (_intent, ctx) => {
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
