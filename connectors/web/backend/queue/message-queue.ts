import type { IMessageQueue, InboundItem } from "../../../../packages/types/src/protocol/backend-connector.ts"

/**
 * v4 Phase C1 (§4.3): bounded in-memory message queue for standalone server mode.
 *
 * Inbound WS frames are pushed here as `InboundItem`s; the single consumer drains via
 * `drain()`. The buffer is bounded (`maxSize`) — when full the oldest item is dropped so
 * backpressure never blocks the transport (§4.3 "backpressure-безопасно").
 */
export class InMemoryMessageQueue implements IMessageQueue {
	private readonly buffer: InboundItem[] = []
	private readonly waiters: Array<(item: InboundItem | undefined) => void> = []
	private readonly maxSize: number
	private closed = false

	constructor(maxSize = 1024) {
		this.maxSize = maxSize
	}

	push(item: InboundItem): void {
		if (this.closed) return
		if (this.buffer.length >= this.maxSize) this.buffer.shift()
		const waiter = this.waiters.shift()
		if (waiter) waiter(item)
		else this.buffer.push(item)
	}

	async *drain(): AsyncIterable<InboundItem> {
		for (;;) {
			const buffered = this.buffer.shift()
			if (buffered !== undefined) {
				yield buffered
				continue
			}
			if (this.closed) return
			const next = await this.nextItem()
			if (next === undefined) return
			yield next
		}
	}

	/** Stops the drain loop and wakes any pending consumer (not part of `IMessageQueue`). */
	close(): void {
		this.closed = true
		for (const waiter of this.waiters.splice(0)) waiter(undefined)
	}

	private nextItem(): Promise<InboundItem | undefined> {
		return new Promise((resolve) => {
			this.waiters.push(resolve)
		})
	}
}
