/**
 * Structural WebSocket surface + browser socket factory (plan §6.2).
 *
 * The connector depends on a minimal structural `WsSocket` interface (rather than the
 * DOM `WebSocket` class) so tests can inject a fake socket in a plain Node environment.
 * `openBrowserSocket` adapts a real browser `WebSocket` onto that surface.
 */

/**
 * Minimal structural subset of the browser `WebSocket` used by the connector.
 */
export interface WsSocket {
	readonly readyState: number
	send(data: string): void
	close(code?: number, reason?: string): void
	onopen: (() => void) | null
	onmessage: ((data: unknown) => void) | null
	onclose: ((info: { code: number; reason: string; wasClean: boolean }) => void) | null
	onerror: (() => void) | null
}

/** Factory used to open the transport socket (test seam; defaults to the browser WebSocket). */
export type SocketFactory = (url: string) => WsSocket

/**
 * Default socket factory: opens a real browser `WebSocket` and proxies its events
 * onto the structural `WsSocket` surface. Only invoked from `connect()`/reconnect,
 * so referencing the `WebSocket` global here never runs outside a browser.
 */
export function openBrowserSocket(url: string): WsSocket {
	if (typeof WebSocket === "undefined") {
		throw new Error("[browser-connector] WebSocket is not available in this environment.")
	}
	const raw = new WebSocket(url)
	const socket: WsSocket = {
		get readyState() {
			return raw.readyState
		},
		send: (data) => raw.send(data),
		close: (code, reason) => raw.close(code, reason),
		onopen: null,
		onmessage: null,
		onclose: null,
		onerror: null,
	}
	raw.addEventListener("open", () => socket.onopen?.())
	raw.addEventListener("message", (event: MessageEvent) => socket.onmessage?.(event.data))
	raw.addEventListener("close", (event: CloseEvent) =>
		socket.onclose?.({ code: event.code, reason: event.reason, wasClean: event.wasClean }),
	)
	raw.addEventListener("error", () => socket.onerror?.())
	return socket
}
