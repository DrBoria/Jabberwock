import type { IntentBus } from "@/features/intents/bus"
import type { ExtensionState, Notification } from "@jabberwock/types"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "@/features/intents/context"
import { getRootStore } from "@/features/root-store"
import { streamingStore } from "@/features/api/streaming/store"
import { getApiMetrics } from "@shared/api/getApiMetrics"
import { combineApiRequests } from "@shared/api/combineApiRequests"
import { combineCommandSequences } from "@shared/combineCommandSequences"

/**
 * Register all frontend chat task event handlers on the IntentBus.
 */
/**
 * Handle abort/cancel of a streaming API request.
 * When abortStream() updates an api_req_started with a cancelReason,
 * reset the streaming state so the button reverts to Submit and the
 * textarea is re-enabled.
 */
function handleStreamAbort(
	store: ReturnType<typeof getRootStore>,
	messages: { ts: number }[],
	payload: { say?: string; text?: string },
): void {
	if (payload.say !== "api_req_started" || !payload.text) return
	let data: { cancelReason?: string }
	try {
		data = JSON.parse(payload.text) as { cancelReason?: string }
	} catch {
		return
	}
	if (!data.cancelReason) return

	const newMessages = [...messages]

	// Ensure the api_req_started notification in the messages array has
	// cancelReason set. When we set extensionState.messages below, the MST
	// reaction fires computeAskDerivedState → computeIsStreaming →
	// hasOrphanApiRequest. Without cancelReason on the notification,
	// hasOrphanApiRequest still returns true and overrides setIsStreaming(false).
	const lastApiReqIndex = [...newMessages]
		.reverse()
		.findIndex((m) => (m as Record<string, unknown>).say === "api_req_started")
	if (lastApiReqIndex !== -1) {
		const idx = newMessages.length - 1 - lastApiReqIndex
		const existing = newMessages[idx] as { text?: string; say?: string }
		try {
			const existingText = JSON.parse(existing.text ?? "{}") as Record<string, unknown>
			if (!existingText.cancelReason) {
				existing.text = JSON.stringify({ ...existingText, cancelReason: data.cancelReason })
			}
		} catch {
			existing.text = payload.text
		}
	}

	// abortStream() in requestAbortManager.ts sets the last message's
	// partial to false on the backend, but does not broadcast that
	// change. Without this, computeIsStreaming still sees partial: true
	// on the last message and keeps the button on "Stop".
	const lastPartialIndex = [...newMessages].reverse().findIndex((m: Record<string, unknown>) => m.partial === true)
	if (lastPartialIndex !== -1) {
		const idx = newMessages.length - 1 - lastPartialIndex
		;(newMessages[idx] as Record<string, unknown>).partial = false
	}

	store.extensionState = { ...store.extensionState, messages: newMessages } as ExtensionState
	store.chat.setIsStreaming(false)
	store.chat.ask.resetAskState()
}

/**
 * Find message index by timestamp, using reverse search.
 */
function findMessageIndex(messages: { ts: number }[], ts: number): number {
	const lastIndex = [...messages].reverse().findIndex((msg: { ts: number }) => msg.ts === ts)
	return lastIndex !== -1 ? messages.length - 1 - lastIndex : -1
}

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

		const index = findMessageIndex(currentMessages, payload.message.ts)
		const currentMsg = payload.message as { ts: number }
		const newMessages =
			index !== -1
				? [...currentMessages.slice(0, index), currentMsg, ...currentMessages.slice(index + 1)]
				: [...currentMessages, currentMsg]

		store.extensionState = { ...store.extensionState, messages: newMessages } as ExtensionState

		// The MESSAGES_UPDATED intent only fires for non-partial (finalized)
		// messages (see on-message-broadcast.ts:56). End the streaming store
		// so the StreamingFooter doesn't keep showing stale content.
		const msg = payload.message as { partial?: boolean } | undefined
		if (msg && !msg.partial) {
			streamingStore.end("")
		}

		// Recompute API metrics when token/cost data is updated.
		const fullMessages = newMessages as Notification[]
		const modifiedMessages = combineApiRequests(combineCommandSequences(fullMessages.slice(1)))
		store.chat.setApiMetrics(getApiMetrics(modifiedMessages))

		// Detect stream abort (cancelReason on api_req_started) and reset
		// streaming state so the button reverts to Submit.
		const saidMsg = payload.message as { say?: string; text?: string } | undefined
		if (saidMsg) {
			handleStreamAbort(store, newMessages, saidMsg)
		}
	})
}
