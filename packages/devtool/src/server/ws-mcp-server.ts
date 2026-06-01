import { WebSocketServer, WebSocket } from "ws"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebSocketServerTransport } from "./transport.js"

const STATIC_PORT = 60060

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Check whether an error is an EADDRINUSE (port already taken). */
function isEaddrinuse(err: unknown): boolean {
	if (!(err instanceof Error)) return false
	const nodeErr = err as NodeJS.ErrnoException
	return (
		nodeErr.code === "EADDRINUSE" ||
		nodeErr.code === "EADDRNOTAVAIL" ||
		nodeErr.message?.includes("EADDRINUSE") ||
		nodeErr.message?.includes("address already in use")
	)
}

/**
 * Fixed short delay between EADDRINUSE retries.
 * We keep this VERY SHORT (50ms) because the installed Roo-Code extension
 * (3.53.0) will try to connect to our WSS immediately on startup. If it
 * finds nothing listening, its MCP SDK Client permanently sets
 * `this.transport = null` with NO auto-reconnect.
 *
 * Exponential backoff (100ms→6.3s) was too slow — the max 3 retries at
 * 50ms each = 150ms total, which is fast enough that Roo-Code hasn't
 * finished its connection logic yet.
 */
function backoff(_attempt: number): number {
	return 50
}

/** Promise-based sleep. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Server class ──────────────────────────────────────────────────────────────

/**
 * WsMcpServer is a WebSocket-based MCP server that replaces the old SSE-based
 * JabberwockMcpServer. Each WebSocket connection gets its own transport adapter
 * and is connected to the shared McpServer instance.
 *
 * Key differences from SSE:
 * - No session ID management (WebSocket connections are self-identifying)
 * - No heartbeat interval (WebSocket has built-in ping/pong)
 * - No POST /messages fallback loop (WebSocket is bidirectional)
 * - No healthcheck endpoint (WebSocket onclose/onerror handles disconnection)
 *
 * NOTE: This class does NOT use globalThis for HMR survival. The MST
 * BackendRootStore snapshot persistence handles state recovery across
 * extension host reloads. On re-activation, the EADDRINUSE retry loop
 * handles the brief TIME_WAIT window from the previous incarnation.
 */
export class WsMcpServer {
	private port: number
	private _mcpServer: McpServer | null = null
	private _wss: WebSocketServer | null = null

	constructor(port: number = STATIC_PORT) {
		this.port = port
	}

	/**
	 * Start the WebSocket MCP server.
	 * Retries up to `maxRetries` times with short delay if the
	 * port is still in TIME_WAIT from a previous process.
	 */
	async start(maxRetries: number = 3): Promise<number> {
		this._mcpServer = new McpServer({ name: "Jabberwock DevTools", version: "1.0.0" })

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

	/**
	 * Get the underlying McpServer instance so tools can be registered on it.
	 */
	getMcpServer(): McpServer {
		if (!this._mcpServer) {
			throw new Error("WsMcpServer not started. Call start() first.")
		}
		return this._mcpServer
	}

	/**
	 * Stop the WebSocket server.
	 * Awaits the underlying server's close event so the port is
	 * released before this promise settles.
	 */
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
