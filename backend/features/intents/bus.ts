import { reaction } from "mobx"
import { IntentStatus } from "@jabberwock/types"
import type { IIntentStore, IIntentPayload } from "./store"
import type { BackendIntentType } from "./IntentConstants"
import { INTENT_PRIORITY, IntentPriority } from "./IntentConstants"
import type { IntentHandlerContext } from "./context"

/**
 * Handler function type — receives the intent payload and context.
 */
export type IntentHandler = (
	intent: { id: string; type: string; payload: IIntentPayload },
	ctx: IntentHandlerContext,
) => Promise<void>

interface FiberWork {
	id: string
	type: string
	priority: number
}

const MAX_INTENTS_PER_BURST = 2000
const MAX_BURST_MS = 250
const WATCHDOG_LOG_INTERVAL_MS = 10_000

/**
 * Runtime dispatcher for intents.
 *
 * Reacts to newly queued intents in IntentStore via a MobX reaction,
 * dispatches them to registered handlers, and marks them Success/Failed.
 *
 * Features register handlers by calling `bus.register(intentType, handler)`
 * from "their" own handler files — one registration per file.
 */
export function IntentBus() {
	const handlers = new Map<string, IntentHandler>()
	let disposer: (() => void) | null = null
	let isProcessing = false
	let queue: {
		enqueue(item: FiberWork): void
		dequeue(): FiberWork | undefined
		peek(): FiberWork | undefined
		hasHigherPriorityThan(p: number): boolean
		size(): number
	} = {
		enqueue: () => {},
		dequeue: () => undefined,
		peek: () => undefined,
		hasHigherPriorityThan: () => false,
		size: () => 0,
	}
	// Dedupe guard for the in-memory dispatch queue. The MobX reaction in
	// `start()` re-evaluates the full queued-id set on every store change (each
	// dispatchIntent/markSuccess flips a status and re-fires it). Without this
	// guard every fire re-enqueues *all* still-queued ids, so the queue
	// accumulates duplicate copies of the same few intents — an O(N²) blowup that
	// starves the bus (queue balloons to tens of thousands of dupes) and causes
	// each intent to be re-executed repeatedly. Tracking enqueued ids bounds the
	// queue to one entry per distinct intent.
	const enqueuedIds = new Set<string>()
	let activeFiber: FiberWork | null = null
	let intentStore!: IIntentStore
	let ctx: IntentHandlerContext | null = null
	let rootRunHandler: (<T>(fn: () => T) => T) | null = null
	// Hot-loop watchdog state: a handler chain that re-queues work on every
	// dispatch would otherwise spin the while-loop below inside the microtask
	// queue and starve the event loop permanently (100% CPU, dead WS/CDP).
	// The burst cap bounds one drain run, logs the offending intent types,
	// yields to the event loop, and lets the reaction re-schedule the rest.
	let lastWatchdogLogAt = 0
	const burstTypeCounts = new Map<string, number>()

	function makeQueue() {
		const items: FiberWork[] = []
		return {
			enqueue(item: FiberWork): void {
				const idx = items.findIndex((i) => i.priority > item.priority)
				if (idx === -1) items.push(item)
				else items.splice(idx, 0, item)
			},
			dequeue(): FiberWork | undefined {
				return items.shift()
			},
			peek(): FiberWork | undefined {
				return items[0]
			},
			hasHigherPriorityThan(p: number): boolean {
				return items.length > 0 && items[0].priority < p
			},
			size(): number {
				return items.length
			},
		}
	}

	function logWatchdog(burstCount: number, elapsedMs: number): void {
		if (Date.now() - lastWatchdogLogAt < WATCHDOG_LOG_INTERVAL_MS) return
		lastWatchdogLogAt = Date.now()
		const top = [...burstTypeCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 6)
			.map(([t, n]) => `${t}=${n}`)
			.join(", ")
		console.error(
			`[IntentBus] WATCHDOG: burst cap hit after ${burstCount} intents / ${elapsedMs}ms — top types: ${top || "(none)"} — queue size ${queue.size()}. Yielding to event loop; re-scheduling remainder.`,
		)
	}

	/**
	 * Set the EventBridge provider on the shared context after bus initialization.
	 * Called from "extension.ts" after the provider is created, so that intent
	 * handlers can access the provider directly without casting rootStore.
	 */
	function setProvider(provider: import("@features/foundation").EventBridge): void {
		if (ctx) {
			;(ctx as { provider?: import("@features/foundation").EventBridge }).provider = provider
			;(ctx as { scheduler?: { yield(): Promise<void> } }).scheduler = { yield: yieldFn }
		}
	}

	/**
	 * Register a handler for a specific intent type.
	 *
	 * One `register()` call per handler file. Multiple handlers per type
	 * are run in registration order sequentially.
	 */
	function register(type: BackendIntentType, handler: IntentHandler): void {
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
	}

	/**
	 * Start the MobX reaction that watches for pending intents.
	 *
	 * Must be called after all handlers are registered and the store is ready.
	 */
	function start(store: IIntentStore, handlerCtx: IntentHandlerContext, rootRunFn?: <T>(fn: () => T) => T): void {
		if (disposer) {
			throw new Error("IntentBus already started — call stop() first")
		}

		ctx = handlerCtx
		intentStore = store
		rootRunHandler = rootRunFn ?? null

		disposer = reaction(
			() => {
				const queued = store.intents.filter((i) => i.status === IntentStatus.Queued)
				return queued.map((i) => i.id)
			},
			(queuedIds) => {
				for (const id of queuedIds) {
					// Skip intents already waiting in the dispatch queue so the
					// reaction cannot accumulate duplicate copies on re-fires.
					if (enqueuedIds.has(id)) continue
					const intent = store.getById(id)
					if (!intent) continue
					const priority = INTENT_PRIORITY[intent.type] ?? IntentPriority.Normal
					enqueuedIds.add(id)
					queue.enqueue({ id, type: intent.type, priority })
				}
				if (!isProcessing) {
					queueMicrotask(() => schedule())
				}
			},
			{ name: "intent-bus-dispatch" },
		)
	}

	/**
	 * Stop the reaction and clear all handlers.
	 */
	function stop(): void {
		if (disposer) {
			disposer()
			disposer = null
		}
		handlers.clear()
		queue = makeQueue()
		enqueuedIds.clear()
		activeFiber = null
		isProcessing = false
	}

	async function schedule(): Promise<void> {
		if (isProcessing) return
		isProcessing = true
		const burstStart = Date.now()
		let burstCount = 0
		burstTypeCounts.clear()
		try {
			while (queue.size() > 0) {
				if (burstCount >= MAX_INTENTS_PER_BURST || Date.now() - burstStart > MAX_BURST_MS) {
					logWatchdog(burstCount, Date.now() - burstStart)
					break
				}
				burstCount = await dispatchNext(burstCount)
			}
			// If we stopped at the burst cap (queue still non-empty), the MobX
			// reaction will NOT re-fire — the store's queued set is unchanged —
			// so re-schedule the remainder ourselves. setTimeout(0) (not
			// queueMicrotask) guarantees a full event-loop turn first, so
			// isProcessing is back to false in the finally block below and the
			// guard in schedule() won't no-op the re-run. This keeps WS/CDP/UI
			// responsive even if some handler re-queues on every dispatch.
			if (queue.size() > 0) {
				setTimeout(() => schedule(), 0)
				return
			}
		} finally {
			isProcessing = false
		}
	}

	/**
	 * Dequeue and dispatch a single intent from "the" dispatch queue.
	 * Returns the updated burst count for the caller's loop accounting.
	 */
	async function dispatchNext(burstCount: number): Promise<number> {
		const next = queue.peek()!
		burstTypeCounts.set(next.type, (burstTypeCounts.get(next.type) ?? 0) + 1)
		burstCount++
		const work = queue.dequeue()!
		// Defense-in-depth: if a stale duplicate was enqueued and the intent
		// has since been processed (no longer Queued), skip it so it cannot
		// be re-executed.
		const pending = intentStore.getById(work.id)
		if (!pending || pending.status !== IntentStatus.Queued) {
			enqueuedIds.delete(work.id)
			return burstCount
		}
		intentStore.dispatchIntent(work.id)
		const handler = handlers.get(work.type)
		if (!handler) {
			intentStore.markSuccess(work.id)
			enqueuedIds.delete(work.id)
			return burstCount
		}
		try {
			activeFiber = work
			await runFiber(handler, work, intentStore)
			activeFiber = null
			intentStore.markSuccess(work.id)
		} catch (err) {
			activeFiber = null
			intentStore.failIntent(work.id)
			console.error(`[IntentBus] Handler for "${work.type}" failed:`, err)
			intentStore.createIntent({
				id: crypto.randomUUID(),
				type: "system.failure",
				payload: { taskId: "", error: String(err) },
				status: IntentStatus.Queued,
				createdAt: Date.now(),
			})
		}
		enqueuedIds.delete(work.id)
		return burstCount
	}

	async function runFiber(handler: IntentHandler, work: FiberWork, store: IIntentStore): Promise<void> {
		const runHandler = rootRunHandler ?? store.runHandler.bind(store)
		await runHandler(() =>
			handler({ id: work.id, type: work.type, payload: store.getById(work.id)?.payload ?? {} }, ctx!),
		)
	}

	async function yieldFn(): Promise<void> {
		if (!activeFiber) return
		if (queue.hasHigherPriorityThan(activeFiber.priority)) {
			const fiber = activeFiber
			intentStore.suspendIntent(fiber.id)
			await schedule()
			intentStore.resumeIntent(fiber.id)
		}
	}

	queue = makeQueue()

	return { setProvider, register, start, stop, yield: yieldFn }
}

export type IntentBus = ReturnType<typeof IntentBus>
