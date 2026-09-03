import type { DisposableLike, IBackendConnector, IMessageQueue, InboundItem } from "@jabberwock/types"

/**
 * v4 §4.2/§4.6: wire the active connector's inbound stream into the capabilities queue.
 *
 * Called ONCE at bootstrap for each host (vscode mode: extension.ts; web mode: web connector
 * main). Every incoming webview/ws message lands in the queue tagged with the transport
 * clientId; the resolver (drain consumer) owns delivery, exactly as in §4.6 topology
 * `connector -> queue -> resolver`.
 *
 * `fallbackClientId` is the clientId used when the transport reports none; callers pass their
 * connector's `id` (e.g. the extension's webview connector, the WS server). It is explicit so
 * the server-reachable import graph stays free of the host-connector literal.
 */
export function wireInboundToQueue(
	connector: IBackendConnector,
	queue: IMessageQueue,
	fallbackClientId: string,
): DisposableLike {
	return connector.onInbound((clientId, body) => {
		queue.push({
			clientId: clientId || fallbackClientId,
			body,
			receivedAt: Date.now(),
		} satisfies InboundItem)
	})
}

/**
 * v4 §4.6: single drain consumer feeding the existing `webviewMessageHandler` resolver.
 *
 * Runs for the lifetime of the process (the in-memory queue is an infinite async iterable).
 * One consumer per process in v1 — `IMessageQueue.drain()` throws on a second call.
 */
export async function drainQueueToResolver(
	queue: IMessageQueue,
	resolver: (item: InboundItem) => Promise<void> | void,
): Promise<void> {
	for await (const item of queue.drain()) {
		try {
			await resolver(item)
		} catch (error) {
			console.error("[jabberwock] [drainQueueToResolver] resolver error:", error)
		}
	}
}
