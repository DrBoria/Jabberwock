import type { InboundItem, IMessageQueue } from "@jabberwock/types"

/**
 * Bounded in-memory implementation of the inbound message queue capability (plan §4.3).
 *
 * Backpressure-safe by construction: `push` is synchronous and never blocks or throws —
 * when the bound is exceeded the oldest item is dropped with a warning, so a slow consumer
 * can never wedge the transport layer. In v1 there is exactly one drain consumer per process;
 * calling `drain()` twice fails fast instead of silently duplicating delivery.
 */
export class InMemoryMessageQueue implements IMessageQueue {
	private readonly items: InboundItem[] = []
	/** Resolves a single pending next() call while the queue is empty and the consumer awaits an item. */
	private waiter: ((item: InboundItem) => void) | undefined

	constructor(private readonly maxItems: number = 1024) {}

	/** Enqueue an inbound item. Synchronous, backpressure-safe (drops oldest when full). */
	push(item: InboundItem): void {
		this.items.push(item)
		while (this.items.length > this.maxItems) {
			const dropped = this.items.shift()
			console.warn(
				`[capabilities] InMemoryMessageQueue full (${this.maxItems}) — dropping oldest item type=${dropped?.body.type ?? "?"}`,
			)
		}
		if (this.waiter !== undefined && this.items.length > 0) {
			const resolve = this.waiter
			this.waiter = undefined
			resolve(this.items.shift() as InboundItem)
		}
	}

	private next(): Promise<InboundItem> {
		const head = this.items.shift()
		if (head !== undefined) return Promise.resolve(head)
		return new Promise((resolve) => {
			this.waiter = resolve
		})
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<InboundItem, void, unknown> {
		for (;;) {
			yield await this.next()
		}
	}

	private drainStarted = false

	/** Single-consumer drain (v1). Second call throws — delivery must not be duplicated. */
	drain(): AsyncIterable<InboundItem> {
		if (this.drainStarted) {
			throw new Error("[capabilities] InMemoryMessageQueue.drain() — single consumer per process in v1")
		}
		this.drainStarted = true
		// The class itself is the async iterable (see Symbol.asyncIterator above) — no alias needed.
		return this
	}
}
