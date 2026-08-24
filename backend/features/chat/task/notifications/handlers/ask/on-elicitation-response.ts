import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { resolveElicitation } from "@features/settings/mcp/mcpIntegration"
import type { ITaskModel } from "@features/chat/task/store"

/**
 * Handles notification.elicitation.response intent — resolves an elicitation prompt.
 */
export function registerOnElicitationResponse(bus: IntentBus): void {
	bus.register(IntentType.NotificationElicitationResponse, async (intent, ctx) => {
		const { values } = intent.payload as { values: unknown }
		if (values) {
			const task = ctx.rootStore.chat.activeTask as ITaskModel | undefined
			if (task) {
				resolveElicitation(task, values as { [key: string]: unknown })
			}
		}
	})
}
