import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { postStateToWebview } from "@features/foundation"
import { sendClearNewChat } from "@features/chat"

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
		await sendClearNewChat(provider)

		ctx.rootStore.foundation.windowManager.clearPendingPushTimers()
		ctx.rootStore.chat.setIsRunning(false)

		await postStateToWebview(provider, {
			messages: [],
			currentTaskItem: undefined,
			isRunning: false,
		} as { [key: string]: unknown })
	})
}
