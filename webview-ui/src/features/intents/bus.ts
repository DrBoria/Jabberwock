import { reaction } from "mobx"
import { IntentStatus } from "@jabberwock/types"
import type { IIntentStore } from "./store"
import type { FrontendIntentType } from "./IntentConstants"
import type { IntentHandlerContext } from "./context"

/**
 * Handler function type — receives the intent payload and context.
 */
export type IntentHandler = (
	intent: { id: string; type: string; payload: Record<string, unknown> },
	ctx: IntentHandlerContext,
) => Promise<void>

/**
 * Runtime dispatcher for intents.
 *
 * Reacts to newly queued intents in IntentStore via a MobX reaction,
 * dispatches them to registered handlers, and marks them Success/Failed.
 *
 * Features register handlers by calling `bus.register(intentType, handler)`
 * from their own handler files — one registration per file.
 */
export class IntentBus {
	private handlers = new Map<string, IntentHandler>()
	private disposer: (() => void) | null = null
	private isProcessing = false
	private processingQueue: string[] = []
	private ctx: IntentHandlerContext | null = null

	/**
	 * Register a handler for a specific intent type.
	 *
	 * One `register()` call per handler file. Multiple handlers per type
	 * are run in registration order sequentially.
	 */
	register(type: FrontendIntentType, handler: IntentHandler): void {
		const existing = this.handlers.get(type)
		if (existing) {
			// Chain handlers for the same type: run in registration order
			const prev = existing
			this.handlers.set(type, async (intent, ctx) => {
				await prev(intent, ctx)
				await handler(intent, ctx)
			})
		} else {
			this.handlers.set(type, handler)
		}
	}

	/**
	 * Start the MobX reaction that watches for pending intents.
	 *
	 * Must be called after all handlers are registered and the store is ready.
	 */
	start(intentStore: IIntentStore, ctx: IntentHandlerContext): void {
		if (this.disposer) {
			throw new Error("IntentBus already started — call stop() first")
		}

		this.ctx = ctx

		this.disposer = reaction(
			() => {
				// Watch for newly queued intents
				const queued = intentStore.intents.filter((i) => i.status === IntentStatus.Queued)
				return queued.map((i) => i.id)
			},
			async (queuedIds) => {
				for (const id of queuedIds) {
					if (!this.processingQueue.includes(id)) {
						this.processingQueue.push(id)
					}
				}
				if (!this.isProcessing) {
					await this.processQueue(intentStore, ctx)
				}
			},
			{ name: "intent-bus-dispatch" },
		)
	}

	/**
	 * Stop the reaction and clear all handlers.
	 */
	stop(): void {
		if (this.disposer) {
			this.disposer()
			this.disposer = null
		}
		this.handlers.clear()
		this.processingQueue = []
		this.isProcessing = false
	}

	private async processQueue(intentStore: IIntentStore, ctx: IntentHandlerContext): Promise<void> {
		if (this.isProcessing) return
		this.isProcessing = true

		try {
			while (this.processingQueue.length > 0) {
				const id = this.processingQueue.shift()!
				const intent = intentStore.getById(id)
				if (!intent || intent.status !== IntentStatus.Queued) continue

				const handler = this.handlers.get(intent.type)
				if (!handler) {
					// No handler for this type — mark as success to prevent
					// infinite reaction loops from unhandled types.
					intentStore.markSuccess(id)
					continue
				}

				intentStore.setProcessing(id)

				try {
					await handler(
						{ id: intent.id, type: intent.type, payload: intent.payload as Record<string, unknown> },
						ctx,
					)
					intentStore.markSuccess(id)
				} catch (err) {
					intentStore.failIntent(id)
					// Errors create a SystemFailure intent so the UI can react.
					// Do not throw — this is a fire-and-forget handler chain.
					console.error(`[IntentBus] Handler for "${intent.type}" failed:`, err)
					intentStore.createIntent({
						id: crypto.randomUUID(),
						type: "system.failure",
						payload: { taskId: (intent.payload as { taskId?: string }).taskId ?? "", error: String(err) },
						status: IntentStatus.Queued,
						createdAt: Date.now(),
					})
				}
			}
		} finally {
			this.isProcessing = false
		}
	}
}
