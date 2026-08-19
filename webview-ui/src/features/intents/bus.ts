import { reaction } from "mobx"
import { IntentStatus } from "@jabberwock/types"
import type { IIntentStore } from "./store"
import type { FrontendIntentType } from "./IntentConstants"
import { INTENT_PRIORITY, IntentPriority } from "./IntentConstants"
import type { IntentHandlerContext } from "./context"

/**
 * Handler function type — receives the intent payload and context.
 */
export type IntentHandler = (
	intent: { id: string; type: string; payload: Record<string, unknown> },
	ctx: IntentHandlerContext,
) => Promise<void>

/**
 * Priority queue — lower `priority` number = higher priority.
 * Items with equal priority maintain insertion order (stable sort).
 */
class PriorityQueue<T extends { priority: number }> {
	private items: T[] = []

	enqueue(item: T): void {
		const idx = this.items.findIndex((i) => i.priority > item.priority)
		if (idx === -1) this.items.push(item)
		else this.items.splice(idx, 0, item)
	}

	dequeue(): T | undefined {
		return this.items.shift()
	}

	hasHigherPriorityThan(p: number): boolean {
		return this.items.length > 0 && this.items[0].priority < p
	}

	get size(): number {
		return this.items.length
	}
}

interface FiberWork {
	id: string
	type: string
	priority: number
}

export class IntentBus {
	private handlers = new Map<string, IntentHandler>()
	private disposer: (() => void) | null = null
	private isProcessing = false
	private queue = new PriorityQueue<FiberWork>()
	private activeFiber: FiberWork | null = null
	private ctx: IntentHandlerContext | null = null
	private intentStore: IIntentStore | null = null
	private rootRunHandler: (<T>(fn: () => T) => T) | null = null

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
	start(intentStore: IIntentStore, ctx: IntentHandlerContext, rootRunHandler?: <T>(fn: () => T) => T): void {
		if (this.disposer) {
			throw new Error("IntentBus already started — call stop() first")
		}
		this.intentStore = intentStore
		this.ctx = ctx
		this.rootRunHandler = rootRunHandler ?? null

		this.disposer = reaction(
			() => {
				const queued = intentStore.intents.filter((i) => i.status === IntentStatus.Queued)
				return queued.map((i) => i.id)
			},
			(queuedIds) => {
				for (const id of queuedIds) {
					const intent = intentStore.getById(id)
					if (!intent) continue
					const priority = INTENT_PRIORITY[intent.type] ?? IntentPriority.Normal
					this.queue.enqueue({ id, type: intent.type, priority })
				}
				if (!this.isProcessing) {
					queueMicrotask(() => this.schedule())
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
		this.queue = new PriorityQueue()
		this.activeFiber = null
		this.isProcessing = false
	}

	setProvider(provider: import("@features/foundation/webview/EventBridge").EventBridge): void {
		if (this.ctx) {
			;(this.ctx as { provider?: import("@features/foundation/webview/EventBridge").EventBridge }).provider =
				provider
			;(this.ctx as { scheduler?: { yield(): Promise<void> } }).scheduler = { yield: this.yield.bind(this) }
		}
	}

	private async schedule(): Promise<void> {
		if (this.isProcessing) return
		this.isProcessing = true
		try {
			while (this.queue.size > 0) {
				const work = this.queue.dequeue()!
				this.intentStore!.dispatchIntent(work.id)
				const handler = this.handlers.get(work.type)
				if (!handler) {
					this.intentStore!.markSuccess(work.id)
					continue
				}
				try {
					this.activeFiber = work
					await this.runFiber(handler, work, this.intentStore!)
					this.activeFiber = null
					this.intentStore!.markSuccess(work.id)
				} catch (err) {
					this.activeFiber = null
					this.intentStore!.failIntent(work.id)
					console.error(`[IntentBus] Handler for "${work.type}" failed:`, err)
					this.intentStore!.createIntent({
						id: crypto.randomUUID(),
						type: "system.failure",
						payload: { taskId: "", error: String(err) },
						status: IntentStatus.Queued,
						createdAt: Date.now(),
					})
				}
			}
		} finally {
			this.isProcessing = false
		}
	}

	private async runFiber(handler: IntentHandler, work: FiberWork, store: IIntentStore): Promise<void> {
		const runHandler = this.rootRunHandler ?? store.runHandler.bind(store)
		await runHandler(() =>
			handler(
				{
					id: work.id,
					type: work.type,
					payload: (store.getById(work.id)?.payload ?? {}) as Record<string, unknown>,
				},
				this.ctx!,
			),
		)
	}

	async yield(): Promise<void> {
		if (!this.activeFiber) return
		if (this.queue.hasHigherPriorityThan(this.activeFiber.priority)) {
			const fiber = this.activeFiber
			this.intentStore!.suspendIntent(fiber.id)
			await this.schedule()
			this.intentStore!.resumeIntent(fiber.id)
		}
	}
}
