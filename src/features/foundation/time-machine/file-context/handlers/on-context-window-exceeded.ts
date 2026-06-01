import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"
import { checkContextWindowExceededError } from "../context-error-handling"

/**
 * Handles context.window.exceeded intent — checks whether an API error
 * is a context-window-exceeded error and handles the result.
 *
 * This handler wraps the standalone checkContextWindowExceededError() utility
 * so it can be invoked through the IntentBus by any part of the system.
 */
export function registerOnContextWindowExceeded(bus: IntentBus): void {
	bus.register(IntentType.ContextWindowExceeded, async (intent, ctx) => {
		const { taskId, error } = intent.payload as {
			taskId: string
			error: unknown
		}

		const task = ctx.rootStore.chat.tasks.get(taskId)
		if (!task) {
			console.error(`[onContextWindowExceeded] Task ${taskId} not found`)
			return
		}

		// Delegate to the standalone error check utility
		const isContextWindowError = checkContextWindowExceededError(error)

		if (isContextWindowError) {
			task.emit?.("context.window.exceeded.detected", { taskId })

			// The actual context window handling (forced truncation) should be
			// performed by the caller via context.management.required intent.
			// This handler only detects and signals the condition.
		}
	})
}
