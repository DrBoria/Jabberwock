import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { unregisterTask } from "@features/chat/task/actions/taskRegistry"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { clearTimeMachineState } from "@features/foundation/time-machine/actions/getTimeMachine"

export function registerOnTaskCompletionRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskCompletionRequested, async (intent, ctx) => {
		const { taskId } = intent.payload as { taskId: string }
		const provider = ctx.provider
		if (!provider) return

		// 1. Clean up module-level registry
		unregisterTask(taskId)

		// 2. Clean up time-machine state
		clearTimeMachineState()

		// 3. Reset running state via MST store
		ctx.rootStore.chat.setIsRunning(false)

		// 4. Push state to webview directly (handler responsibility)
		await postStateToWebview(provider)
	})
}
