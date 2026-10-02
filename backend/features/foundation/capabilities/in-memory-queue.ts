import type { InboundItem, IMessageQueue } from "@jabberwock/types"

/**
 * InMemoryMessageQueue — in-memory FIFO queue with bounded size.
 *
 * Oldest items are evicted when the queue exceeds `maxItems`.
 *
 * @param maxItems — maximum number of items to keep (default 1024)
 */
export function InMemoryMessageQueue(maxItems = 1024): IMessageQueue {
	const items: InboundItem[] = []

	function makeIterable(): AsyncIterable<InboundItem> {
		let index = 0
		return {
			async *[Symbol.asyncIterator]() {
				while (true) {
					while (index < items.length) {
						yield items[index++]
					}
					await new Promise((r) => setTimeout(r, 10))
				}
			},
		}
	}

	return {
		push(item: InboundItem): void {
			items.push(item)
			if (items.length > maxItems) {
				items.shift()
			}
		},

		drain(): AsyncIterable<InboundItem> {
			return makeIterable()
		},
	}
}
