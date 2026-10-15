/**
 * MCP WebSocket Server (extension host side, port 60060).
 *
 * - WsMcpServer: WebSocket-based MCP server. Each connection gets its own
 *   transport adapter connected to the shared McpServer instance.
 * - WebSocketServerTransport: Adapts a ws WebSocket to the MCP SDK Transport.
 */

import { WebSocketServer, WebSocket } from "ws"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"
import { isEaddrinuse, backoff, sleep } from "./errors.js"

import { WS_PORT } from "./errors.js"

const STATIC_PORT = WS_PORT

/** The McpServer instance shared by all WebSocket connections. */
const createMcpServer = (): McpServer =>
	new McpServer({ name: "vscode-extension-devtool-mcp", version: "1.0.0" }, { capabilities: { tools: {} } })

/**
 * Wraps a WebSocket connection into the MCP SDK's Transport interface.
 * WebSocket is bidirectional by nature — no session management, no
 * healthcheck polling, no fallback loops.
 */
export class WebSocketServerTransport implements Transport {
	onclose?: () => void
	onerror?: (error: Error) => void
	onmessage?: (message: JSONRPCMessage) => void

	private messageHandler: (data: Buffer) => void
	private closeHandler: () => void
	private errorHandler: (err: Error) => void

	constructor(private ws: WebSocket) {
		this.messageHandler = (data) => {
			try {
				const message = JSON.parse(data.toString())
				this.onmessage?.(message)
			} catch (err) {
				this.onerror?.(err as Error)
			}
		}
		this.closeHandler = () => this.onclose?.()
		this.errorHandler = (err) => this.onerror?.(err)

		ws.on("message", this.messageHandler)
		ws.on("close", this.closeHandler)
		ws.on("error", this.errorHandler)
	}

	/** Detach all event listeners (e.g. before replacing the transport on HMR). */
	detach(): void {
		this.ws.off("message", this.messageHandler)
		this.ws.off("close", this.closeHandler)
		this.ws.off("error", this.errorHandler)
	}

	/** The connection is already established when this transport is created. */
	async start(): Promise<void> {}

	async send(message: JSONRPCMessage): Promise<void> {
		this.ws.send(JSON.stringify(message))
	}

	async close(): Promise<void> {
		this.ws.close()
	}
}

/**
 * WebSocket-based MCP server: each connection gets its own transport adapter
 * connected to the shared McpServer instance. No session IDs, heartbeats or
 * healthcheck endpoints — WebSocket handles all of that natively.
 *
 * Does NOT use globalThis for HMR survival: the MST BackendRootStore snapshot
 * persistence handles state recovery across extension host reloads, and the
 * EADDRINUSE retry loop handles the brief TIME_WAIT window on re-activation.
 */
export class WsMcpServer {
	private port: number
	private _mcpServer: McpServer | null = null
	private _wss: WebSocketServer | null = null

	constructor(port: number = STATIC_PORT) {
		this.port = port
	}

	/**
	 * Create the McpServer WITHOUT starting the listener. Register tools on
	 * the returned server, then call start() — this prevents a client from
	 * connecting before tools are registered.
	 */
	createServer(): McpServer {
		this._mcpServer = createMcpServer()
		return this._mcpServer
	}

	/**
	 * Start the WebSocket MCP server, reusing the McpServer from
	 * createServer() when present. Retries on EADDRINUSE (the port may still
	 * be in TIME_WAIT from a previous process).
	 */
	async start(maxRetries: number = 3): Promise<number> {
		if (!this._mcpServer) {
			this._mcpServer = createMcpServer()
		}

		let lastError: Error | null = null

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await this.tryBind(attempt)
			} catch (err: unknown) {
				lastError = err as Error
				// Only retry on EADDRINUSE (port still held by previous process)
				if (!isEaddrinuse(err)) throw err

				console.warn(
					`[devtool] [WsMcpServer] Port ${this.port} in use (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoff(attempt)}ms...`,
				)
				await sleep(backoff(attempt))
			}
		}

		// Exhausted retries
		this._mcpServer = null
		throw lastError ?? new Error(`Failed to bind to port ${this.port} after ${maxRetries + 1} attempts`)
	}

	private tryBind(attempt: number): Promise<number> {
		return new Promise((resolve, reject) => {
			const wss = new WebSocketServer({ port: this.port, host: "127.0.0.1" })
			this._wss = wss

			wss.on("connection", (ws: WebSocket) => {
				const transport = new WebSocketServerTransport(ws)
				this._mcpServer!.connect(transport).catch((err) => {
					console.error(`[devtool] [WsMcpServer] MCP connect error: ${err.message}`)
				})
			})

			wss.on("error", (err: Error) => {
				console.error(`[devtool] [WsMcpServer] Server error: ${err.message}`)
				this._wss = null
				// Close the failed server so it doesn't linger
				try {
					wss.close()
				} catch {
					/* already closed */
				}
				reject(err)
			})

			wss.on("listening", () => {
				console.log(`[WsMcpServer] Listening on port ${this.port} (attempt ${attempt + 1})`)
				resolve(this.port)
			})
		})
	}

	/** The underlying McpServer instance. */
	getMcpServer(): McpServer {
		if (!this._mcpServer) {
			throw new Error("WsMcpServer not started. Call start() or createServer() first.")
		}
		return this._mcpServer
	}

	/** Stop the server; awaits close so the port is released. */
	async stop(): Promise<void> {
		if (this._wss) {
			const server = this._wss
			this._wss = null
			this._mcpServer = null

			// Close all existing client connections first.
			for (const ws of server.clients) {
				ws.close(1001, "Server shutting down")
			}

			// Await the server's close event so the OS releases the port.
			await new Promise<void>((resolve) => {
				server.close(() => resolve())
			})
		} else {
			this._mcpServer = null
		}
	}
}
