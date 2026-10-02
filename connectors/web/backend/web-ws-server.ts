import * as http from "node:http"
import type { BackendCapabilities, ClientTarget, DisposableLike, IBackendConnector } from "@jabberwock/types"
import type { WebviewMessage } from "@jabberwock/types"
import { WsServerCore, toInboundItem } from "@jabberwock/ws-protocol"

export { toInboundItem }

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
	 * client fully-bootstrapped backend state instead of the empty `{}` from "Phase" C1.
	 * Defaults to an empty object when omitted.
	 */
	getState?: () => Record<string, unknown>
}

/**
 * v4 Phase C1 (§6): WebSocket backend connector for standalone server mode.
 *
 * Thin host wrapper over the shared {@link WsServerCore} transport (v4 single-state §4.1):
 * it owns the HTTP server + bind address, and delegates the full WS protocol
 * (hello → state handshake, `ConnectorEnvelope` framing, multi-client registry,
 * broadcast/targeted `sendOutbound`, inbound dispatch, pubsub events) to the core.
 *
 * The vscode extension host (`connectors/vscode`) uses the same core so every WS client
 * speaks the identical protocol regardless of which host owns the backend.
 */
export class WebWsServer implements IBackendConnector {
	readonly id = "web" as const

	private readonly core: WsServerCore
	private readonly options: WebWsServerOptions
	private httpServer?: http.Server

	constructor(options: WebWsServerOptions) {
		this.options = options
		// The core attaches its WebSocketServer to this HTTP server; the caller may supply
		// their own (smoke harness) in which case we never listen/close it here.
		const server = options.server ?? http.createServer()
		this.httpServer = server
		this.core = new WsServerCore({ server, path: "/ws", getState: options.getState })
	}

	// ─── IBackendConnector ───────────────────────────────────────────
	async start(deps: BackendCapabilities, _opts?: Record<string, unknown>): Promise<void> {
		this.core.start(deps)

		if (this.options.server) {
			// Caller owns the HTTP server lifecycle; nothing to listen on here.
			return
		}

		const httpServer = this.httpServer as http.Server
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
		this.core.stop()
		if (this.httpServer && this.httpServer !== this.options.server) {
			await new Promise<void>((resolve) => this.httpServer?.close(() => resolve()))
		}
		this.httpServer = undefined
	}

	sendOutbound(message: { type: string; [key: string]: unknown }, target?: ClientTarget): void {
		this.core.sendOutbound(message, target)
	}

	onInbound(handler: (clientId: string, body: WebviewMessage) => void): DisposableLike {
		return this.core.onInbound(handler)
	}
}
