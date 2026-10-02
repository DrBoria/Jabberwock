import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { unregisterTask } from "@features/chat"
import { postStateToWebview } from "@features/foundation"
import { clearTimeMachineState } from "@features/foundation/time-machine"
import type { Notification } from "@jabberwock/types"
import { getSnapshot } from "mobx-state-tree"
import { sendMessageUpdated } from "@features/chat"

export function registerOnTaskCompletionRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskCompletionRequested, async (intent, ctx) => {
		const { taskId } = intent.payload as { taskId: string }
		const provider = ctx.provider
		if (!provider) return

		// 0. Push final content of any still-partial notifications (e.g. the live
		// reasoning row) to the webview. Per-chunk updates for partials are
		// intentionally suppressed, and the state push below carries no messages,
		// so without this the thinking block would stay frozen at its first chunk
		// ("The") when reasoning is the last notification of the task.
		try {
			const task = ctx.rootStore.chat.tasks.get(taskId)
			if (task) {
				const items = getSnapshot(task.notifications.items as never) as Notification[]
				for (const n of items) {
					if (n.partial === true) sendMessageUpdated(n)
				}
			}
		} catch (err) {
			console.warn(`[onTaskCompletionRequested] stale partial flush failed for task ${taskId}:`, err)
		}

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
