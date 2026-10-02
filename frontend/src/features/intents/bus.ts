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
export interface PriorityQueue<T extends { priority: number }> {
	enqueue(item: T): void
	dequeue(): T | undefined
	hasHigherPriorityThan(p: number): boolean
	readonly size: number
}

function createPriorityQueue<T extends { priority: number }>() {
	const items: T[] = []
	return {
		enqueue(item: T): void {
			const idx = items.findIndex((i) => i.priority > item.priority)
			if (idx === -1) items.push(item)
			else items.splice(idx, 0, item)
		},
		dequeue(): T | undefined {
			return items.shift()
		},
		hasHigherPriorityThan(p: number): boolean {
			return items.length > 0 && items[0].priority < p
		},
		get size(): number {
			return items.length
		},
	}
}

interface FiberWork {
	id: string
	type: string
	priority: number
}

export interface IntentBus {
	/**
	 * Register a handler for a specific intent type.
	 *
	 * One `register()` call per handler file. Multiple handlers per type
	 * are run in registration order sequentially.
	 */
	register(type: FrontendIntentType, handler: IntentHandler): void
	/**
	 * Start the MobX reaction that watches for pending intents.
	 *
	 * Must be called after all handlers are registered and the store is ready.
	 */
	start(intentStore: IIntentStore, ctx: IntentHandlerContext, rootRunHandler?: <T>(fn: () => T) => T): void
	/** Stop the reaction and clear all handlers. */
	stop(): void
	setProvider(provider: import("@features/foundation/webview/EventBridge").EventBridge): void
	/** Yield to a higher-priority fiber if one is queued. */
	yield(): Promise<void>
}

/**
 * Create an IntentBus.
 *
 * Factory-closure form (no class): handlers / queue / fiber state live in the
 * closure, not module state.
 */
export function createIntentBus(): IntentBus {
	const handlers = new Map<string, IntentHandler>()
	let disposer: (() => void) | null = null
	let isProcessing = false
	let queue = createPriorityQueue<FiberWork>()
	let activeFiber: FiberWork | null = null
	let ctx: IntentHandlerContext | null = null
	let intentStore: IIntentStore | null = null
	let rootRunHandler: (<T>(fn: () => T) => T) | null = null

	async function runFiber(handler: IntentHandler, work: FiberWork, store: IIntentStore): Promise<void> {
		const runHandler = rootRunHandler ?? store.runHandler.bind(store)
		await runHandler(() =>
			handler(
				{
					id: work.id,
					type: work.type,
					payload: (store.getById(work.id)?.payload ?? {}) as Record<string, unknown>,
				},
				ctx!,
			),
		)
	}

	async function schedule(): Promise<void> {
		if (isProcessing) return
		isProcessing = true
		try {
			while (queue.size > 0) {
				const work = queue.dequeue()!
				intentStore!.dispatchIntent(work.id)
				const handler = handlers.get(work.type)
				if (!handler) {
					intentStore!.markSuccess(work.id)
					continue
				}
				try {
					activeFiber = work
					await runFiber(handler, work, intentStore!)
					activeFiber = null
					intentStore!.markSuccess(work.id)
				} catch (err) {
					activeFiber = null
					intentStore!.failIntent(work.id)
					console.error(`[IntentBus] Handler for "${work.type}" failed:`, err)
					intentStore!.createIntent({
						id: crypto.randomUUID(),
						type: "system.failure",
						payload: { taskId: "", error: String(err) },
						status: IntentStatus.Queued,
						createdAt: Date.now(),
					})
				}
			}
		} finally {
			isProcessing = false
		}
	}

	async function yield_(): Promise<void> {
		if (!activeFiber) return
		if (queue.hasHigherPriorityThan(activeFiber.priority)) {
			const fiber = activeFiber
			intentStore!.suspendIntent(fiber.id)
			await schedule()
			intentStore!.resumeIntent(fiber.id)
		}
	}

	return {
		register(type: FrontendIntentType, handler: IntentHandler): void {
			const existing = handlers.get(type)
			if (existing) {
				// Chain handlers for the same type: run in registration order
				const prev = existing
				handlers.set(type, async (intent, ctxArg) => {
					await prev(intent, ctxArg)
					await handler(intent, ctxArg)
				})
			} else {
				handlers.set(type, handler)
			}
		},

		start(
			intentStoreArg: IIntentStore,
			ctxArg: IntentHandlerContext,
			rootRunHandlerArg?: <T>(fn: () => T) => T,
		): void {
			if (disposer) {
				throw new Error("IntentBus already started — call stop() first")
			}
			intentStore = intentStoreArg
			ctx = ctxArg
			rootRunHandler = rootRunHandlerArg ?? null

			disposer = reaction(
				() => {
					const queued = intentStoreArg.intents.filter((i) => i.status === IntentStatus.Queued)
					return queued.map((i) => i.id)
				},
				(queuedIds) => {
					for (const id of queuedIds) {
						const intent = intentStoreArg.getById(id)
						if (!intent) continue
						const priority = INTENT_PRIORITY[intent.type] ?? IntentPriority.Normal
						queue.enqueue({ id, type: intent.type, priority })
					}
					if (!isProcessing) {
						queueMicrotask(() => schedule())
					}
				},
				{ name: "intent-bus-dispatch" },
			)
		},

		stop(): void {
			if (disposer) {
				disposer()
				disposer = null
			}
			handlers.clear()
			queue = createPriorityQueue()
			activeFiber = null
			isProcessing = false
		},

		setProvider(provider: import("@features/foundation/webview/EventBridge").EventBridge): void {
			if (ctx) {
				;(ctx as { provider?: import("@features/foundation/webview/EventBridge").EventBridge }).provider =
					provider
				;(ctx as { scheduler?: { yield(): Promise<void> } }).scheduler = { yield: yield_ }
			}
		},

		yield: yield_,
	}
}
