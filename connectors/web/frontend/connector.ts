/**
 * BrowserWsFrontendConnector — v4 frontend host adapter for standalone server mode.
 *
 * Implements `IFrontendConnector` (plan §4.4) by adapting the WebSocket transport
 * of the standalone server (`connectors/web/backend`, WS endpoint `/ws`) into an
 * in-app `IConnectorEventBus` (plan §4.5).
 *
 * Transport model (plan §6.2): one full-duplex WebSocket per client. Client frames are
 * `ConnectorEnvelope { protocolVersion, sentAt, body }`; the server answers the `hello`
 * handshake with a `state` frame carrying the hydration snapshot. The connector runs the
 * hello -> state handshake on every (re)connect and surfaces inbound host frames (state,
 * streamChunk, ...) to bus subscribers. Reconnect uses exponential backoff; the server
 * re-hydrates on each `hello`.
 *
 * DOM-local loopback (plan §4.5 line 463, criterion C-4): WS frames carry ONLY host
 * protocol. DOM-local class B traffic arrives via `window.postMessage` and is looped
 * back to subscribers in-process by the event bus — never on the wire (see `event-bus.ts`).
 *
 * WS URL resolution (plan §9.4): 1. explicit `options.wsUrl`; 2. runtime-injected
 * `window.__JABBERWOCK_CONFIG__?.wsUrl` (config.js); 3. same-origin `/ws` derived from
 * `window.location` (dev vite proxy / simple mode).
 *
 * This is the ONLY browser-side code that touches the raw host transport. App-level code
 * (frontend/src/**) must go through the connector bus.
 */

import type { IConnectorEventBus, IFrontendConnector, InboundAppMessage, WebviewMessage } from "@jabberwock/types"
import { PROTOCOL_VERSION } from "@jabberwock/types"

import { BrowserWsEventBus, type WindowLike } from "./event-bus"
import { openBrowserSocket, type SocketFactory, type WsSocket } from "./socket"

/**
 * Runtime-injected config (plan §9.4): nginx (or the dev server) serves a small
 * `config.js` that sets `window.__JABBERWOCK_CONFIG__ = { wsUrl }` so the same bundle
 * works on any host/port without baking the WS URL into the build.
 */
interface JabberwockRuntimeConfig {
	wsUrl?: string
}

/** `window` extended with the optional runtime config blob. */
interface JabberwockWindow extends Window {
	__JABBERWOCK_CONFIG__?: JabberwockRuntimeConfig
}

/** Client kind advertised in the `hello` handshake (plan §6.2). */
export type BrowserClientKind = "browser" | "watch"

/** Options for the browser frontend connector. */
export interface BrowserWsConnectorOptions {
	/** Explicit WS URL override (highest priority; plan §9.4). */
	wsUrl?: string
	/** Client kind advertised in the `hello` handshake (plan §6.2). */
	clientKind?: BrowserClientKind
	/** Base reconnect delay in ms (doubles per attempt). */
	reconnectBaseMs?: number
	/** Upper bound for the reconnect delay in ms. */
	reconnectMaxMs?: number
	/** Test seam: socket factory (defaults to the browser WebSocket). */
	socketFactory?: SocketFactory
	/** Test seam: document window for the DOM-local loopback listener (defaults to `window`). */
	windowLike?: WindowLike | null
}

/** Loose outbound frame body used for the WS handshake and host messages. */
type FrameBody = { type: string; [key: string]: unknown }

/**
 * A free-form object with a string `type` — the minimum shape of every message that
 * travels through the connector (envelope body, DOM-local messages, inbound frames).
 */
function isMessageLike(value: unknown): value is { type: unknown } {
	return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string"
}

/**
 * A free-form object shaped like a ConnectorEnvelope: it carries a `protocolVersion`
 * and a `body` object. The message `type` discriminator lives on `body`, not on the
 * envelope itself.
 */
function isEnvelopeLike(value: unknown): value is { protocolVersion?: unknown; body?: unknown } {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { protocolVersion?: unknown }).protocolVersion !== "undefined" &&
		typeof (value as { body?: unknown }).body === "object" &&
		(value as { body?: unknown }).body !== null
	)
}

/**
 * Browser WebSocket frontend connector for standalone server mode.
 *
 * `connect()` opens the WS, performs the hello -> state handshake and resolves once the
 * first `hello` has been sent. Later transport drops trigger an exponential backoff
 * reconnect that re-runs the handshake (the server re-hydrates). Until a subscriber
 * attaches, inbound frames are cached by the bus so hydration is not lost.
 */
export class BrowserWsFrontendConnector implements IFrontendConnector {
	readonly id = "web" as const

	private readonly options: Required<
		Pick<BrowserWsConnectorOptions, "clientKind" | "reconnectBaseMs" | "reconnectMaxMs">
	>
	private readonly socketFactory: SocketFactory
	private readonly bus: BrowserWsEventBus
	private readonly wsUrl: string

	private socket: WsSocket | null = null
	private socketOpen = false
	private closedByUser = false
	private hasConnectedOnce = false
	private reconnectAttempt = 0
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private connectResolve: (() => void) | null = null
	private connectReject: ((error: Error) => void) | null = null

	constructor(options: BrowserWsConnectorOptions = {}) {
		this.options = {
			clientKind: options.clientKind ?? "browser",
			reconnectBaseMs: options.reconnectBaseMs ?? 500,
			reconnectMaxMs: options.reconnectMaxMs ?? 15000,
		}
		this.socketFactory = options.socketFactory ?? openBrowserSocket
		this.wsUrl = this.resolveWsUrl(options.wsUrl)
		this.bus = new BrowserWsEventBus({
			windowLike: options.windowLike !== undefined ? options.windowLike : this.defaultWindow(),
			sendFrame: (message) => this.sendFrame(message),
		})
	}

	get eventBus(): IConnectorEventBus {
		return this.bus
	}

	async connect(_opts?: Record<string, unknown>): Promise<void> {
		this.closedByUser = false
		this.reconnectAttempt = 0
		await new Promise<void>((resolve, reject) => {
			this.connectResolve = resolve
			this.connectReject = reject
			this.openSocket()
		})
	}

	disconnect(): void {
		this.closedByUser = true
		this.clearReconnectTimer()
		this.bus.dispose()
		if (this.socket) {
			try {
				this.socket.close()
			} catch {
				// Ignore close errors during teardown.
			}
			this.socket = null
		}
		this.socketOpen = false
	}

	// ─── WS URL resolution ────────────────────────────────────────────

	private resolveWsUrl(explicit?: string): string {
		if (explicit) {
			return explicit
		}
		if (typeof window !== "undefined") {
			const runtime = (window as JabberwockWindow).__JABBERWOCK_CONFIG__
			const configured = runtime?.wsUrl
			if (configured && configured !== "auto") {
				return configured
			}
			const protocol = window.location.protocol === "https:" ? "wss" : "ws"
			return `${protocol}://${window.location.host}/ws`
		}
		throw new Error(
			"[browser-connector] Cannot resolve the WS URL outside a browser (no window). Pass options.wsUrl explicitly.",
		)
	}

	/** Default DOM-local loopback window when running in a real browser. */
	private defaultWindow(): WindowLike | null {
		return typeof window !== "undefined" ? window : null
	}

	// ─── Connection lifecycle ─────────────────────────────────────────

	/** Open the transport socket and wire its event handlers. */
	private openSocket(): void {
		if (this.closedByUser) {
			return
		}
		this.clearReconnectTimer()
		let socket: WsSocket
		try {
			socket = this.socketFactory(this.wsUrl)
		} catch (error) {
			this.failConnect(error instanceof Error ? error : new Error(String(error)))
			return
		}
		this.socket = socket
		this.socketOpen = false

		socket.onopen = () => {
			this.socketOpen = true
			this.hasConnectedOnce = true
			this.reconnectAttempt = 0
			this.sendHello()
			this.connectResolve?.()
			this.connectResolve = null
			this.connectReject = null
		}
		socket.onmessage = (data) => this.handleSocketMessage(data)
		socket.onerror = () => {
			// The error event is always followed by `close`, which owns recovery.
		}
		socket.onclose = () => {
			this.socketOpen = false
			this.socket = null
			if (this.closedByUser) {
				return
			}
			if (!this.hasConnectedOnce) {
				this.failConnect(new Error(`[browser-connector] WS connection to ${this.wsUrl} failed.`))
				return
			}
			this.scheduleReconnect()
		}
	}

	/** Reject the initial `connect()` promise (only relevant before the first successful open). */
	private failConnect(error: Error): void {
		this.connectReject?.(error)
		this.connectResolve = null
		this.connectReject = null
	}

	/** Schedule a reconnect with exponential backoff (plan §4.4 lines 418-439). */
	private scheduleReconnect(): void {
		if (this.closedByUser || this.reconnectTimer) {
			return
		}
		const delay = Math.min(this.options.reconnectBaseMs * 2 ** this.reconnectAttempt, this.options.reconnectMaxMs)
		this.reconnectAttempt += 1
		console.warn(`[browser-connector] WS closed; reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}).`)
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			this.openSocket()
		}, delay)
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
	}

	// ─── Frames ───────────────────────────────────────────────────────

	/** Wrap an outbound body in a ConnectorEnvelope and send it (plan §6.2). */
	private sendFrame(message: WebviewMessage): void {
		if (!this.socket || !this.socketOpen) {
			console.warn("[browser-connector] publish() while WS is not open; frame dropped (reconnect re-hydrates).")
			return
		}
		const envelope = {
			protocolVersion: PROTOCOL_VERSION,
			sentAt: Date.now(),
			body: message,
		}
		this.socket.send(JSON.stringify(envelope))
	}

	/** Send the `hello` handshake frame (plan §6.2). */
	private sendHello(): void {
		if (!this.socket) {
			return
		}
		const body: FrameBody = { type: "hello", clientKind: this.options.clientKind }
		const envelope = { protocolVersion: PROTOCOL_VERSION, sentAt: Date.now(), body }
		this.socket.send(JSON.stringify(envelope))
	}

	/** Parse an inbound WS frame and route its body to bus subscribers. */
	private handleSocketMessage(data: unknown): void {
		// The server always sends text frames (JSON.stringify'd envelopes), so binary
		// payloads (Blob/ArrayBuffer) are not expected and are ignored.
		if (typeof data !== "string") {
			console.warn("[browser-connector] Ignoring a non-text WS frame.")
			return
		}
		let parsed: unknown
		try {
			parsed = JSON.parse(data)
		} catch {
			console.warn("[browser-connector] Ignoring a malformed WS frame.")
			return
		}
		// The frame is a ConnectorEnvelope: { protocolVersion, clientId?, sentAt, body }.
		// The message `type` discriminator lives on `body`, not on the envelope itself.
		if (!isEnvelopeLike(parsed)) {
			console.warn("[browser-connector] Ignoring a frame that is not a ConnectorEnvelope.")
			return
		}
		const candidate = parsed as { protocolVersion?: unknown; body?: unknown }
		if (candidate.protocolVersion !== PROTOCOL_VERSION) {
			console.warn("[browser-connector] Ignoring a frame with an unsupported protocolVersion.")
			return
		}
		const body: unknown = candidate.body
		if (!isMessageLike(body)) {
			console.warn("[browser-connector] Ignoring a frame without a message body.")
			return
		}
		this.bus.dispatchInbound(body as InboundAppMessage)
	}
}
