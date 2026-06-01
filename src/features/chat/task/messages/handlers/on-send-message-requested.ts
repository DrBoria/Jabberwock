import { IntentType, IntentStatus } from "@jabberwock/types"
import type { IntentBus } from "../../../../intents/bus"
import { sendMessage } from "../actions/sendMessage"

/**
 * When a "send message to agent" intent fires, forward to sendMessage().
 *
 * On error, creates a SystemFailure intent — no ctx.logger, no console.error.
 */
export function registerOnSendMessageRequested(bus: IntentBus): void {
	bus.register(IntentType.SendMessageToAgentRequested, async (intent, ctx) => {
		const { taskId, prompt } = intent.payload as {
			taskId: string
			prompt: string
		}

		try {
			if (ctx.provider) {
				await sendMessage(ctx.provider, prompt)
			}
		} catch (err) {
			ctx.intentStore.createIntent({
				id: crypto.randomUUID(),
				type: IntentType.SystemFailure,
				payload: { taskId, error: String(err) },
				status: IntentStatus.Queued,
				createdAt: Date.now(),
			})
		}
	})
}
