import WebSocket from "ws"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"

/**
 * Minimal MCP Transport adapter for WebSocket clients.
 * Implements the MCP SDK Transport interface using the `ws` library.
 */
export class WebSocketClientTransport implements Transport {
	private ws: WebSocket | null = null
	private url: string
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelay = 1000 // 1 second initial delay
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private isReconnecting = false
	private wasEverConnected = false // Track if we ever connected successfully

	onclose?: () => void
	onerror?: (error: Error) => void
	onmessage?: (message: unknown) => void

	constructor(url: string) {
		this.url = url
	}

	/**
	 * Start the WebSocket connection with retry logic.
	 * Retries up to `maxReconnectAttempts` times with exponential backoff
	 * if the initial connection fails. This handles race conditions where
	 * the target WebSocket server (e.g. Devtool) hasn't started listening yet.
	 */
	async start(): Promise<void> {
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= this.maxReconnectAttempts; attempt++) {
			if (attempt > 0) {
				const delay = this.reconnectDelay * Math.pow(2, attempt - 1)
				console.log(
					`[WebSocketClientTransport] Retrying connection to ${this.url} in ${delay}ms (attempt ${attempt + 1}/${this.maxReconnectAttempts + 1})`,
				)
				await new Promise((r) => setTimeout(r, delay))
			}

			try {
				await this.tryConnect()
				this.wasEverConnected = true
				this.reconnectAttempts = 0
				return // Connected successfully
			} catch (err) {
				lastError = err as Error
				console.log(
					`[WebSocketClientTransport] Connection attempt ${attempt + 1}/${this.maxReconnectAttempts + 1} failed: ${(err as Error).message}`,
				)
			}
		}

		// All connection attempts exhausted
		throw lastError ?? new Error(`Failed to connect to ${this.url} after ${this.maxReconnectAttempts + 1} attempts`)
	}

	/**
	 * Single WebSocket connection attempt with 10-second timeout.
	 */
	private tryConnect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(this.url)
			} catch (err) {
				reject(err)
				return
			}

			// Connection timeout: reject if WebSocket doesn't open within 10 seconds.
			// This prevents hanging forever when the target server is not yet listening
			// (e.g., Devtool WebSocket server still starting up).
			const timeout = setTimeout(() => {
				const err = new Error(`WebSocket connection timeout to ${this.url}`)
				this.onerror?.(err)
				reject(err)
				this.ws?.close()
			}, 10_000)

			this.ws.on("open", () => {
				clearTimeout(timeout)
				resolve()
			})

			this.ws.on("message", (data: Buffer) => {
				try {
					const message = JSON.parse(data.toString())
					this.onmessage?.(message)
				} catch (err) {
					this.onerror?.(err as Error)
				}
			})

			this.ws.on("close", () => {
				clearTimeout(timeout)
				this.onclose?.()
				// Only auto-reconnect if we were ever connected successfully.
				// This prevents reconnect loops when the initial connection fails
				// (e.g., devtools server not yet listening).
				if (this.wasEverConnected) {
					this.scheduleReconnect()
				}
			})

			this.ws.on("error", (err: Error) => {
				clearTimeout(timeout)
				this.onerror?.(err)
				reject(err) // CRITICAL: reject the start promise so connectToServer catch block runs
			})
		})
	}

	private scheduleReconnect(): void {
		if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
			return
		}
		this.isReconnecting = true
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
		console.log(
			`[WebSocketClientTransport] Scheduling reconnect attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} in ${delay}ms`,
		)
		this.reconnectTimer = setTimeout(async () => {
			this.reconnectAttempts++
			this.isReconnecting = false
			try {
				await this.start()
				console.log(
					`[WebSocketClientTransport] Reconnected successfully after ${this.reconnectAttempts} attempt(s)`,
				)
			} catch (err) {
				console.error(
					`[jabberwock] [WebSocketClientTransport] Reconnect attempt ${this.reconnectAttempts} failed:`,
					err,
				)
			}
		}, delay)
	}

	async send(message: unknown): Promise<void> {
		if (!this.ws) {
			throw new Error("WebSocket not connected")
		}
		this.ws.send(JSON.stringify(message))
	}

	async close(): Promise<void> {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.isReconnecting = false
		this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnect after explicit close
		this.ws?.close()
		this.ws = null
	}
}
