import { WebSocketServer, WebSocket } from "ws"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebSocketServerTransport } from "./transport.js"

// ── globalThis state ──────────────────────────────────────────────────────────
// Module-scoped variables are re-created on every extension hot-reload, but the
// old WebSocket server may still be alive and bound to the same port.  We store
// everything in globalThis so the reloaded module can find and tear down the
// previous incarnation before starting a new one.
interface WsGlobalState {
	wss: WebSocketServer | undefined
	mcpServer: McpServer | undefined
}

const GLOBAL_KEY = "__jabberwock_ws_mcp_global_state"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalState = globalThis as any

function getOrCreateGlobalState(): WsGlobalState {
	if (!globalState[GLOBAL_KEY]) {
		globalState[GLOBAL_KEY] = {
			wss: undefined,
			mcpServer: undefined,
		} satisfies WsGlobalState
	}
	return globalState[GLOBAL_KEY] as WsGlobalState
}

const gs = getOrCreateGlobalState()

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
 */
export class WsMcpServer {
	private port: number

	constructor(port: number = STATIC_PORT) {
		this.port = port
	}

	/**
	 * Start (or restart after HMR) the WebSocket MCP server.
	 * If a previous server exists in globalThis, it is reused.
	 * Retries up to `maxRetries` times with exponential backoff if the
	 * port is still in TIME_WAIT from a previous incarnation.
	 */
	async start(maxRetries: number = 3): Promise<number> {
		// Always create a fresh McpServer so new tool handlers (from the current
		// module load) are registered. On HMR, this replaces the old McpServer's
		// tool set — existing client connections are "upgraded" below.
		const mcpServer = new McpServer({ name: "Jabberwock DevTools", version: "1.0.0" })
		gs.mcpServer = mcpServer

		if (gs.wss) {
			// ── Hot-module replacement path ──────────────────────────────
			// The WebSocket server survived across an extension reload. We must
			// reconnect every existing client to the *new* McpServer so that
			// tool calls route to the freshly-loaded module's handlers instead
			// of stale references from the previous module.
			//
			// First, remove ALL event listeners from every existing WebSocket
			// connection. The old transports (created by the previous module)
			// attached message/close/error listeners — leaving them active
			// would cause duplicate message processing (both the old and new
			// McpServer would respond to the same JSON-RPC request).
			for (const ws of gs.wss.clients) {
				ws.removeAllListeners("message")
				ws.removeAllListeners("close")
				ws.removeAllListeners("error")
			}

			// Now create fresh transports and connect them to the new McpServer.
			for (const ws of gs.wss.clients) {
				const transport = new WebSocketServerTransport(ws)
				mcpServer.connect(transport)
			}

			// Replace the wss "connection" handler so any *new* clients that
			// connect after HMR also get routed to the new McpServer.
			gs.wss.removeAllListeners("connection")
			gs.wss.on("connection", (ws: WebSocket) => {
				const transport = new WebSocketServerTransport(ws)
				mcpServer.connect(transport)
			})

			return this.port
		}

		// ── First-time initialization path ──────────────────────────────
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await this.tryBind(mcpServer, attempt)
			} catch (err: unknown) {
				lastError = err as Error
				// Only retry on EADDRINUSE (port still held by previous process)
				if (!isEaddrinuse(err)) throw err

				console.warn(
					`[WsMcpServer] Port ${this.port} in use (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoff(attempt)}ms...`,
				)
				await sleep(backoff(attempt))
			}
		}

		// Exhausted retries
		gs.mcpServer = undefined
		throw lastError ?? new Error(`Failed to bind to port ${this.port} after ${maxRetries + 1} attempts`)
	}

	private tryBind(mcpServer: McpServer, attempt: number): Promise<number> {
		return new Promise((resolve, reject) => {
			const wss = new WebSocketServer({ port: this.port, host: "127.0.0.1" })
			gs.wss = wss

			wss.on("connection", (ws: WebSocket) => {
				const transport = new WebSocketServerTransport(ws)
				mcpServer.connect(transport).catch((err) => {
					console.error(`[WsMcpServer] MCP connect error: ${err.message}`)
				})
			})

			wss.on("error", (err: Error) => {
				console.error(`[WsMcpServer] Server error: ${err.message}`)
				gs.wss = undefined
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
		if (!gs.mcpServer) {
			throw new Error("WsMcpServer not started. Call start() first.")
		}
		return gs.mcpServer
	}

	/**
	 * Stop the WebSocket server and clean up global state.
	 * Awaits the underlying server's close event so the port is
	 * released before this promise settles.
	 */
	async stop(): Promise<void> {
		if (gs.wss) {
			const server = gs.wss
			gs.wss = undefined
			gs.mcpServer = undefined

			// Close all existing client connections first.
			for (const ws of server.clients) {
				ws.close(1001, "Server shutting down")
			}

			// Await the server's close event so the OS releases the port.
			await new Promise<void>((resolve) => {
				server.close(() => resolve())
			})
		} else {
			gs.mcpServer = undefined
		}
	}
}
