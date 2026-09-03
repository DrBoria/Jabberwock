import * as http from "node:http"
import { randomUUID } from "node:crypto"
import { WebSocketServer, WebSocket } from "ws"
import type {
	BackendCapabilities,
	ClientTarget,
	DisposableLike,
	IBackendConnector,
	InboundItem,
} from "../../../../packages/types/src/protocol/backend-connector.ts"
import {
	ConnectorEnvelope,
	PROTOCOL_VERSION,
	unwrapEnvelope,
} from "../../../../packages/types/src/protocol/envelope.ts"
import type { WebviewMessage } from "../../../../packages/types/src/webview/message.ts"
import { ClientRegistry } from "./client-registry.ts"

export interface WebWsServerOptions {
	port: number
	/** Bind address: loopback (default) or a NetBird TUN IP (§7.2). */
	bindAddress: string
	/** When true the server also serves the built SPA from `frontend/build` (§7.3 simple mode). */
	serveStatic: boolean
	/** Absolute path to the built frontend (`frontend/build`); only used when `serveStatic` is true. */
	staticDir?: string
	/** Optional HTTP server to attach to (used by the standalone smoke harness). */
	server?: http.Server
	/**
	 * Optional provider for the `state` payload sent on the hello → state handshake (§6.2).
	 * Phase C2 wires this to the shared `startBackend()` bootstrap so the server hands the
	 * client fully-bootstrapped backend state instead of the empty `{}` from Phase C1.
	 * Defaults to an empty object when omitted.
	 */
	getState?: () => Record<string, unknown>
}

/**
 * v4 Phase C1 (§6): WebSocket backend connector for standalone server mode.
 *
 * Implements `IBackendConnector` over a single full-duplex WS channel per client:
 *   - `/ws` endpoint speaking §6.2 frames wrapped in the §4.1 `ConnectorEnvelope`
 *   - hello → state handshake (client sends `{type:"hello", clientKind}`; server replies
 *     with a `state` frame carrying `_hydration: true`)
 *   - clientId registry for multiple simultaneous clients (§6.3)
 *   - `sendOutbound` delivers broadcast or targeted frames per `ClientTarget`
 *   - inbound frames are dispatched to `onInbound` handlers (bootstrap pushes them into
 *     the capabilities queue)
 */
export class WebWsServer implements IBackendConnector {
	readonly id = "web" as const

	private readonly registry = new ClientRegistry()
	private readonly inboundHandlers: Array<(clientId: string, body: WebviewMessage) => void> = []
	private readonly options: WebWsServerOptions
	private capabilities?: BackendCapabilities
	private httpServer?: http.Server
	private wss?: WebSocketServer

	constructor(options: WebWsServerOptions) {
		this.options = options
	}

	// ─── IBackendConnector ───────────────────────────────────────────
	async start(deps: BackendCapabilities, _opts?: Record<string, unknown>): Promise<void> {
		this.capabilities = deps
		const httpServer = this.options.server ?? http.createServer()
		this.httpServer = httpServer

		const wss = new WebSocketServer({ server: httpServer, path: "/ws" })
		this.wss = wss
		wss.on("connection", (socket) => this.handleConnection(socket))

		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error): void => reject(error)
			httpServer.once("error", onError)
			httpServer.listen(this.options.port, this.options.bindAddress, () => {
				httpServer.off("error", onError)
				resolve()
			})
		})
	}

	async stop(): Promise<void> {
		this.wss?.close()
		this.wss = undefined
		if (this.httpServer && this.httpServer !== this.options.server) {
			await new Promise<void>((resolve) => this.httpServer?.close(() => resolve()))
		}
		this.httpServer = undefined
		this.inboundHandlers.length = 0
		this.capabilities = undefined
	}

	sendOutbound(message: { type: string; [key: string]: unknown }, target?: ClientTarget): void {
		const sockets = this.registry.resolve(target ?? { kind: "broadcast" })
		const envelope: ConnectorEnvelope<{ type: string; [key: string]: unknown }> = {
			protocolVersion: PROTOCOL_VERSION,
			sentAt: Date.now(),
			body: message,
		}
		const frame = JSON.stringify(envelope)
		for (const socket of sockets) {
			if (socket.readyState === WebSocket.OPEN) socket.send(frame)
		}
	}

	onInbound(handler: (clientId: string, body: WebviewMessage) => void): DisposableLike {
		this.inboundHandlers.push(handler)
		return { dispose: () => this.removeInboundHandler(handler) }
	}

	// ─── Handshake + frame handling ──────────────────────────────────
	private handleConnection(socket: WebSocket): void {
		let clientId: string | undefined
		let clientKind = "browser"

		socket.on("message", (data) => {
			let raw: unknown
			try {
				raw = JSON.parse(data.toString())
			} catch {
				this.sendError(socket, "malformed-json")
				return
			}

			let body: { type: string; [key: string]: unknown }
			try {
				body = unwrapEnvelope<{ type: string; [key: string]: unknown }>(raw).body
			} catch (error) {
				this.sendError(socket, "bad-envelope", String(error))
				return
			}

			// The hello frame is a WS-transport handshake, not a standard WebviewMessage.
			if (body.type === "hello") {
				clientKind = typeof body.clientKind === "string" ? body.clientKind : "browser"
				clientId = randomUUID()
				this.registry.register({ clientId, clientKind, socket, connectedAt: Date.now() })
				this.sendState(socket, clientId)
				this.publish("client.connected", { clientId, clientKind })
				return
			}

			if (clientId === undefined) {
				this.sendError(socket, "not-handshaked")
				return
			}

			this.dispatchInbound(clientId, body as WebviewMessage)
		})

		socket.on("close", () => {
			if (clientId) {
				this.registry.unregister(clientId)
				this.publish("client.disconnected", { clientId })
			}
		})
	}

	private sendState(socket: WebSocket, clientId: string): void {
		const state = this.options.getState ? this.options.getState() : {}
		const envelope: ConnectorEnvelope<{ type: string; [key: string]: unknown }> = {
			protocolVersion: PROTOCOL_VERSION,
			clientId,
			sentAt: Date.now(),
			body: { type: "state", state, _hydration: true },
		}
		socket.send(JSON.stringify(envelope))
	}

	private sendError(socket: WebSocket, code: string, detail?: string): void {
		const envelope: ConnectorEnvelope<{ type: string; [key: string]: unknown }> = {
			protocolVersion: PROTOCOL_VERSION,
			sentAt: Date.now(),
			body: { type: "error", code, detail },
		}
		if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(envelope))
	}

	private dispatchInbound(clientId: string, body: WebviewMessage): void {
		for (const handler of [...this.inboundHandlers]) {
			try {
				handler(clientId, body)
			} catch (error) {
				console.error("[WebWsServer] inbound handler error:", error)
			}
		}
	}

	private publish(topic: string, payload: unknown): void {
		this.capabilities?.pubsub.publish(topic, payload)
	}

	private removeInboundHandler(handler: (clientId: string, body: WebviewMessage) => void): void {
		const idx = this.inboundHandlers.indexOf(handler)
		if (idx !== -1) this.inboundHandlers.splice(idx, 1)
	}
}

/** Convenience: wrap an inbound item for the queue consumer. */
export function toInboundItem(clientId: string, body: WebviewMessage, receivedAt = Date.now()): InboundItem {
	return { clientId, body, receivedAt }
}
