import { WebSocket } from "ws"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"

/**
 * WebSocketServerTransport wraps a WebSocket connection into the MCP SDK's Transport interface.
 *
 * Unlike SSE (which requires session IDs, heartbeat intervals, and a POST /messages fallback),
 * WebSocket is bidirectional by nature — messages flow freely in both directions over a single
 * persistent connection. No session management, no healthcheck polling, no fallback loops.
 *
 * Usage:
 *   const ws = new WebSocket("ws://127.0.0.1:60060/ws")
 *   const transport = new WebSocketServerTransport(ws)
 *   mcpServer.connect(transport)
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

	/**
	 * Detaches all event listeners from the underlying WebSocket.
	 * Call this before replacing the transport for an existing connection
	 * (e.g. during HMR when a new McpServer takes over).
	 */
	detach(): void {
		this.ws.off("message", this.messageHandler)
		this.ws.off("close", this.closeHandler)
		this.ws.off("error", this.errorHandler)
	}

	/**
	 * Server-side transport: the WebSocket connection is already established
	 * when this transport is created, so start() is a no-op.
	 */
	async start(): Promise<void> {
		// no-op: connection is already active
	}

	async send(message: JSONRPCMessage): Promise<void> {
		this.ws.send(JSON.stringify(message))
	}

	async close(): Promise<void> {
		this.ws.close()
	}
}
