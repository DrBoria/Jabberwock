import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import type { AskResponseValue } from "@jabberwock/types"

/**
 * Handles ask.response.received intent — processes user's response to an ask
 * (approve/deny) and performs the actual work: resolving the ask promise,
 * creating checkpoints, marking asks as answered, and persisting state.
 */
import { resolveAskResponse } from "@features/chat/task/notifications/actions/respondToAsk"

export function registerOnAskResponseReceived(bus: IntentBus): void {
	bus.register(IntentType.AskResponseReceived, async (intent, ctx) => {
		const { taskId, response, text, images } = intent.payload as {
			taskId: string
			response: string
			text?: string
			images?: string[]
		}

		const store = ctx.rootStore.chat.tasks.get(taskId)
		if (!store) {
			console.error(`[onAskResponseReceived] Task ${taskId} not found`)
			return
		}

		resolveAskResponse(taskId, response as AskResponseValue, text ?? "", images ?? [])
	})
}
