import type { DisposableLike, IPubSub } from "../../../../packages/types/src/protocol/backend-connector.ts"

/**
 * v4 Phase C1 (§4.3): in-process topic pub/sub for standalone server mode.
 *
 * Fills the `pubsub` capability slot that vscode mode fills with EventBridge. Topics
 * follow §4.3 conventions, e.g. `client.connected`, `client.disconnected`,
 * `notification.ask`, `notification.ask.resolved`.
 */
export class TopicPubSub implements IPubSub {
	private readonly listeners = new Map<string, Set<(payload: unknown) => void>>()

	publish(topic: string, payload: unknown): void {
		const handlers = this.listeners.get(topic)
		if (!handlers) return
		for (const handler of [...handlers]) {
			try {
				handler(payload)
			} catch (error) {
				console.warn(`[TopicPubSub] handler error on topic "${topic}": ${String(error)}`)
			}
		}
	}

	subscribe(topic: string, handler: (payload: unknown) => void): DisposableLike {
		let handlers = this.listeners.get(topic)
		if (!handlers) {
			handlers = new Set()
			this.listeners.set(topic, handlers)
		}
		handlers.add(handler)
		return { dispose: () => handlers.delete(handler) }
	}
}
