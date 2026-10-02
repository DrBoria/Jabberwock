import type { ApiMessage } from "@features/chat"
import type { ITaskModel } from "@features/chat/task"
import { getStore } from "@features/singleton"

/**
 * Handles API messages that carry a `notification_action` content block.
 *
 * These messages are created when the user interacts with a notification,
 * e.g. pressing "Proceed", "Cancel", or requesting a fallback.
 *
 * @param task  - The task model to mutate.
 * @param message - The API message containing the notification_action block.
 */
export function onNotificationMessage(task: ITaskModel, message: ApiMessage): void {
	const content = message.content
	if (!content || (typeof content === "string" ? !content : content.length === 0)) {
		return
	}

	if (typeof content === "string") {
		return
	}

	const action = (
		content[0] as
			| (import("@anthropic-ai/sdk/resources/messages").ContentBlockParam & { [key: string]: unknown })
			| undefined
	)?.notification_action as string | undefined

	switch (action) {
		case "proceed":
			// Continue execution — unpause the task
			task.setIsPaused(false)
			break

		case "fallback":
			// Fallback to alternative logic
			// Clears pending state and triggers fallback behaviour
			task.setAbort(true)
			// Also signal ChatStore-level abort so startTask()'s when() resolves
			getStore().chat.setAbort(true)
			console.warn(`[onNotificationMessage] fallback action not fully implemented for task ${task.taskId}`)
			break

		case "cancel":
			// Cancel current operation
			task.setAbort(true)
			// Also signal ChatStore-level abort so startTask()'s when() resolves
			getStore().chat.setAbort(true)
			break

		default:
			// Unknown action — no-op
			break
	}
}
