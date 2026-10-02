import { IntentConstants } from "@intentConstants"
import { getSnapshot } from "mobx-state-tree"
import type { IntentBus, IntentHandlerContext } from "@features/intents"
import type { Notification } from "@jabberwock/types"
import { saveMessages } from "@features/chat/task/messages/actions/save"

/**
 * Register a handler for all 4 message broadcast intent types
 * (agent, system, MCP, user).
 *
 * When a broadcast action creator emits an Intent, this handler:
 * 1. Adds (or updates) the notification in the MST store
 * 2. Saves messages to disk
 *
 * The `action` field in the payload determines whether to create or update:
 * - "create" → calls `addNotification(taskId, notification)`
 * - "update" → mutates the existing notification in-place + saves
 */
import { addNotification } from "@features/chat/task/notifications/actions"
import { sendMessageUpdated } from "@features/chat"

/**
 * Push final content of any still-partial notifications (e.g. the live "reasoning"
 * row) to the webview.
 *
 * Partial (streaming) updates are intentionally NOT pushed per-chunk (see the
 * "update" branch below), and the sendStreamChunk() fast path only covers plain
 * text chunks — so a partial row otherwise stays frozen at its FIRST chunk in
 * the webview (the thinking block shows "The" instead of the full reasoning)
 * until the next webview launch rehydrates from "disk." When a new finalized
 * message lands (a "create", or a non-partial "update"), every other partial
 * notification in the store already holds its final text (the bus drains
 * intents in order), so we flush it once via the same messageUpdated channel
 * the frontend already handles (replace-by-ts in the MESSAGES_UPDATED handler).
 */
function flushStalePartials(store: { notifications: { items: unknown } }, exceptTs: number): void {
	const items = getSnapshot(store.notifications.items as never) as Notification[]
	for (const n of items) {
		if (n.partial === true && n.ts !== exceptTs) {
			sendMessageUpdated(n)
		}
	}
}

/**
 * Flip every still-partial notification row to `partial: false` in the MST
 * store.
 *
 * Must run here (not only in `finalizeToolCalls`) because the intent bus is
 * asynchronous: the late per-chunk partial "reasoning" updates are queued
 * ahead of this finalized message, so by the time this handler runs the bus
 * has drained them and the store rows already hold their final text — but
 * their `partial` flag is still `true` (the stream-end finalizer in
 * `finalizeToolCalls` ran before the drain). Without this flip the
 * `saveMessages` below would persist `partial: true` reasoning rows, which
 * the frontend renders differently after a reload.
 */
function finalizePartialRows(store: {
	notifications: { items: unknown; updateNotification: (index: number, msg: Notification) => void }
}): void {
	const items = getSnapshot(store.notifications.items as never) as Notification[]
	for (let i = 0; i < items.length; i++) {
		const n = items[i]
		if (n.partial === true) {
			store.notifications.updateNotification(i, { ...n, partial: false })
		}
	}
}

export function registerOnMessageBroadcast(bus: IntentBus): void {
	const broadcastTypes = [
		IntentConstants.messages.AGENT_BROADCAST,
		IntentConstants.messages.SYSTEM_BROADCAST,
		IntentConstants.messages.MCP_BROADCAST,
		IntentConstants.messages.USER_BROADCAST,
	] as const

	for (const type of broadcastTypes) {
		bus.register(type, async (intent, ctx: IntentHandlerContext) => {
			const payload = intent.payload as {
				taskId: string
				notification: Notification
				action: "create" | "update"
			}

			const store = ctx.rootStore.chat.tasks.get(payload.taskId)
			if (!store) {
				console.error(`[onMessageBroadcast] Task ${payload.taskId} not found`)
				return
			}

			if (payload.action === "update") {
				const index = store.notifications.items.findIndex((n: Notification) => n.ts === payload.notification.ts)
				if (index !== -1) {
					store.notifications.updateNotification(index, payload.notification)
				} else {
					store.notifications.addNotification(payload.notification)
				}
				// ── Streaming performance optimisation ─────────────────────
				// Partial (streaming) updates always skip disk I/O — persistence is
				// deferred until the stream ends (non-partial flush). Webview push is
				// the exception: text partials ride the sendStreamChunk() fast path,
				// but non-text partials (reasoning) have no such path, so they need an
				// explicit sendMessageUpdated to keep the thinking block live.
				if (!payload.notification.partial) {
					// A finalized message means any earlier partial rows (the live
					// reasoning row) have stopped receiving per-chunk updates — push
					// their final store content once so the webview stops showing the
					// first chunk ("The") for the thinking block. Must run BEFORE
					// finalizePartialRows, which clears the partial flags the
					// snapshot-based flush reads.
					flushStalePartials(store, payload.notification.ts)
					// The bus has drained every earlier intent (FIFO), so all
					// other partial rows hold their final text — flip them now,
					// before the save, so the disk file never holds
					// `partial: true` rows.
					finalizePartialRows(store)
					await saveMessages(payload.taskId)
					sendMessageUpdated(payload.notification)
				} else if (payload.notification.say !== "text") {
					// Partial streaming updates for non-text says (chiefly "reasoning")
					// have NO sendStreamChunk() fast path — that exception only carries
					// plain text chunks (see streamRunner.ts). Without this, a partial
					// reasoning row mutates the MST store but never reaches the webview,
					// so the thinking block stays frozen at its first chunk ("The") until
					// the next finalized message triggers flushStalePartials. Text partials
					// are intentionally left to the sendStreamChunk fast path above.
					sendMessageUpdated(payload.notification)
				}
			} else {
				await addNotification(payload.taskId, payload.notification)
				if (payload.notification.partial !== true) {
					// Persist finalized broadcasts to disk. `addNotification` only
					// mutates the MST store (the old MobX save reaction is gone),
					// so without this a final `completion_result`/`text` say would
					// live only in memory and be lost on reload — most visibly on
					// the implicit-completion path, which skips the blocking ask
					// whose answer used to trigger the disk save.
					// Same flush for new finalized messages created in the same
					// phase (e.g. the assistant text block landing right after
					// reasoning). Snapshot-based, so run before the partial flip.
					flushStalePartials(store, payload.notification.ts)
					finalizePartialRows(store)
					await saveMessages(payload.taskId)
				}
			}
		})
	}
}
