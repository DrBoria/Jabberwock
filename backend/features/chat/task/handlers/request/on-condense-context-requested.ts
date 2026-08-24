import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { condenseContext } from "@features/chat/task/condense/actions/condenseContext"

/**
 * Handles task.condense.context.requested intent — triggers context condensation.
 */
export function registerOnTaskCondenseContextRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskCondenseContextRequested, async (_intent, ctx) => {
		const task = ctx.rootStore.chat.activeTask
		if (task) {
			void condenseContext(task)
		}
	})
}
