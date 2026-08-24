import type { ITaskModel } from "@features/chat/task/store"
import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { unregisterTask } from "@features/chat/task/actions/taskRegistry"
import { clearTimeMachineState } from "@features/foundation/time-machine/actions/getTimeMachine"

function abortActiveTask(activeTask: ITaskModel | undefined): void {
	activeTask?.abortTask?.()
	if (activeTask) {
		unregisterTask(activeTask.taskId)
	}
}

function collectCancelMessages(activeTask: ITaskModel | undefined): Array<{ partial?: boolean }> | undefined {
	const notificationItems = activeTask?.notifications?.items
	const messages = notificationItems?.length ? notificationItems.map((n) => ({ ...n })) : undefined
	if (!messages?.length) return messages
	const last = messages[messages.length - 1]
	if (last.partial === true) {
		messages[messages.length - 1] = { ...last, partial: false }
	}
	return messages
}

/**
 * Handles task.cancel.requested intent — cancels the active task.
 * Stops the agent but preserves messages in the UI (does not close the task window).
 */
export function registerOnTaskCancelRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskCancelRequested, async (_intent, ctx) => {
		const provider = ctx.provider

		if (!provider) {
			return
		}

		const activeTask = ctx.rootStore.chat.activeTask
		abortActiveTask(activeTask)

		// Clean up time-machine state
		clearTimeMachineState()

		ctx.rootStore.foundation.windowManager.clearPendingPushTimers()
		ctx.rootStore.chat.setIsRunning(false)

		const messages = collectCancelMessages(activeTask)

		await postStateToWebview(provider, {
			messages,
			isRunning: false,
		} as { [key: string]: unknown })
	})
}
