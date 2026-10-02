import { randomUUID } from "node:crypto"
import type * as http from "node:http"
import { WebSocketServer, WebSocket } from "ws"
import type { RawData } from "ws"
import {
	PROTOCOL_VERSION,
	unwrapEnvelope,
	type ClientTarget,
	type ConnectorEnvelope,
	type InboundItem,
	type BackendCapabilities,
	type DisposableLike,
	type WebviewMessage,
} from "@jabberwock/types"
import { ClientRegistry } from "./client-registry.js"

/**
 * v4 single-state (§4.1): shared WS transport core.
 *
 * Implements the full WS protocol — hello→state handshake, `ConnectorEnvelope`
 * framing, multi-client registry, broadcast/targeted `sendOutbound`, inbound
 * dispatch, and pubsub `client.connected`/`client.disconnected` events — on top of
 * a `WebSocketServer` that the caller attaches to their own HTTP server.
 *
 * Used verbatim by both the standalone web server (`connectors/web`) and the vscode
 * extension host (`connectors/vscode`) so every WS client (browser, smartwatch, APK)
 * speaks the same protocol regardless of which host owns the backend.
 */
export interface WsServerCoreOptions {
	/** HTTP server to attach the WebSocketServer to. */
	server: http.Server
	/** WS upgrade path. Default `/ws`. */
	path?: string
	/**
	 * Snapshot of the backend root store sent on the hello→state handshake.
	 * Called once per connecting client, after `hello` is received. Defaults to `{}`.
	 */
	getState?: () => Record<string, unknown>
}

/**
 * Build an `InboundItem` from a parsed WS envelope body.
 */
export function toInboundItem(clientId: string, body: WebviewMessage, receivedAt = Date.now()): InboundItem {
	return { clientId, body, receivedAt }
}

export class WsServerCore {
	readonly registry = new ClientRegistry()
	private readonly inboundHandlers: Array<(clientId: string, body: WebviewMessage) => void> = []
	private capabilities?: BackendCapabilities
	private wss?: WebSocketServer
	private started = false

	constructor(private readonly options: WsServerCoreOptions) {}

	get isStarted(): boolean {
		return this.started
	}

	/** Attach the WebSocketServer to the caller's HTTP server and begin accepting clients. */
	start(capabilities: BackendCapabilities): void {
		if (this.started) return
		this.capabilities = capabilities
		this.wss = new WebSocketServer({ server: this.options.server, path: this.options.path ?? "/ws" })
		this.wss.on("connection", (socket: WebSocket) => this.handleConnection(socket))
		this.started = true
	}

	/** Close the WebSocketServer and clear handlers. The HTTP server is owned by the caller. */
	stop(): void {
		this.wss?.close()
		this.wss = undefined
		this.inboundHandlers.length = 0
		this.capabilities = undefined
		this.started = false
	}

	/**
	 * Send a message to the given client or broadcast to all.
	 * No-op when the target client is not connected (the message is dropped).
	 */
	sendOutbound(message: { type: string; [key: string]: unknown }, target?: ClientTarget): void {
		if (!this.started) return
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

	/**
	 * Register an inbound handler. Returns a `Disposable` that unregisters it.
	 * The handler is invoked for every non-handshake inbound message, with the
	 * connecting client's `clientId`.
	 */
	onInbound(handler: (clientId: string, body: WebviewMessage) => void): DisposableLike {
		this.inboundHandlers.push(handler)
		return { dispose: () => this.removeInboundHandler(handler) }
	}

	// ─── Handshake + frame handling ──────────────────────────────────
	private handleConnection(socket: WebSocket): void {
		let clientId: string | undefined

		socket.on("message", (data: RawData) => {
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
				const clientKind = typeof body.clientKind === "string" ? body.clientKind : "browser"
				clientId = randomUUID()
				this.registry.register({ clientId, clientKind, socket, connectedAt: Date.now() })
				this.sendState(socket, clientId)
				this.publish("client.connected", { clientId, clientKind })
				return
			}

			// Reject frames from sockets that have not completed the handshake.
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
				console.error("[WsServerCore] inbound handler error:", error)
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
