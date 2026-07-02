import type { IntentBus } from "@/features/intents/bus"
import type { ExtensionState } from "@jabberwock/types"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "@/features/intents/context"
import { getRootStore } from "@/features/root-store"
import { streamingStore } from "@/features/api/streaming/store"

/**
 * Register all frontend chat task event handlers on the IntentBus.
 */
export function registerOnFrontendTaskIntents(bus: IntentBus): void {
	bus.register(IntentConstants.task.CHECKPOINT_UPDATED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		store.currentCheckpoint = (intent.payload as { text?: string }).text ?? ""
	})

	bus.register(IntentConstants.task.CHECKPOINT_INIT_WARNING, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as {
			checkpointWarning?: { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number }
		}
		store.chat.setCheckpointWarning(payload.checkpointWarning)
	})

	bus.register(IntentConstants.task.TASK_WITH_AGGREGATED_COSTS, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as {
			text?: string
			aggregatedCosts?: { totalCost: number; ownCost: number; childrenCost: number }
		}
		if (payload.text && payload.aggregatedCosts) {
			store.chat.updateAggregatedCosts(payload.text, payload.aggregatedCosts)
		}
	})

	bus.register(IntentConstants.task.CONDENSE_STARTED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { text?: string }
		if (payload.text) store.chat.setIsCondensing(true)
	})

	bus.register(IntentConstants.task.CONDENSE_RESPONSE, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { text?: string }
		if (payload.text) {
			if (store.chat.isCondensing && store.chat.textArea.sendingDisabled)
				store.chat.textArea.setSendingDisabled(false)
			store.chat.setIsCondensing(false)
		}
	})

	bus.register(IntentConstants.task.SELECTED_IMAGES, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { context?: string; images?: string[] }
		if (payload.context !== "edit" && payload.images) {
			store.chat.textArea.appendSelectedImages(payload.images.slice(0, 20))
		}
	})

	bus.register(IntentConstants.task.MESSAGES_UPDATED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { ts?: number; message?: { ts: number; partial?: boolean } }
		if (!payload.message) return
		const currentMessages = store.extensionState.messages
		const lastIndex = [...currentMessages]
			.reverse()
			.findIndex((msg: { ts: number }) => msg.ts === payload.message!.ts)
		const index = lastIndex !== -1 ? currentMessages.length - 1 - lastIndex : -1
		const currentMsg = payload.message as { ts: number }
		let newMessages: { ts: number }[]
		if (index !== -1) {
			newMessages = [...currentMessages]
			newMessages[index] = currentMsg
		} else {
			newMessages = [...currentMessages, currentMsg]
		}
		store.extensionState = { ...store.extensionState, messages: newMessages } as ExtensionState

		// ── Streaming cleanup ──────────────────────────────────────────
		// The MESSAGES_UPDATED intent only fires for non-partial (finalized)
		// messages (see on-message-broadcast.ts:56). When the final message
		// arrives, end the streaming store so the StreamingFooter doesn't
		// keep showing stale streaming content alongside the now-finalized
		// ChatRow.
		const msg = payload.message as { partial?: boolean } | undefined
		if (msg && !msg.partial) {
			streamingStore.end("")
		}
	})
}
