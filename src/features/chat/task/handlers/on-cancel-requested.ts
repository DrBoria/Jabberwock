import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { unregisterTask } from "@features/chat/task/actions/taskRegistry"
import { clearTimeMachineState } from "@features/foundation/time-machine/actions/getTimeMachine"

/**
 * Handles task.cancel.requested intent — cancels the active task.
 */
export function registerOnTaskCancelRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskCancelRequested, async (_intent, ctx) => {
		const provider = ctx.provider

		if (!provider) {
			return
		}

		const activeTask = ctx.rootStore.chat.activeTask
		activeTask?.abortTask?.()

		// Clean up module-level registry
		if (activeTask) {
			unregisterTask(activeTask.taskId)
		}

		// Clean up time-machine state
		clearTimeMachineState()

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
