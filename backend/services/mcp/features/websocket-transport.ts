import WebSocket from "ws"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"

/**
 * Minimal MCP Transport adapter for WebSocket clients.
 * Implements the MCP SDK Transport interface using the `ws` library.
 */
export function WebSocketClientTransport(url: string): Transport {
	let ws: WebSocket | null = null
	let reconnectAttempts = 0
	const maxReconnectAttempts = 5
	const reconnectDelay = 1000 // 1 second initial delay
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null
	let isReconnecting = false
	let wasEverConnected = false // Track if we ever connected successfully

	let onclose: (() => void) | undefined
	let onerror: ((error: Error) => void) | undefined
	let onmessage: ((message: unknown) => void) | undefined

	/**
	 * Start the WebSocket connection with retry logic.
	 * Retries up to `maxReconnectAttempts` times with exponential backoff
	 * if the initial connection fails. This handles race conditions where
	 * the target WebSocket server (e.g. Devtool) hasn't started listening yet.
	 */
	async function start(): Promise<void> {
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= maxReconnectAttempts; attempt++) {
			if (attempt > 0) {
				const delay = reconnectDelay * Math.pow(2, attempt - 1)
				console.log(
					`[WebSocketClientTransport] Retrying connection to ${url} in ${delay}ms (attempt ${attempt + 1}/${maxReconnectAttempts + 1})`,
				)
				await new Promise((r) => setTimeout(r, delay))
			}

			try {
				await tryConnect()
				wasEverConnected = true
				reconnectAttempts = 0
				return // Connected successfully
			} catch (err) {
				lastError = err as Error
				console.log(
					`[WebSocketClientTransport] Connection attempt ${attempt + 1}/${maxReconnectAttempts + 1} failed: ${(err as Error).message}`,
				)
			}
		}

		// All connection attempts exhausted
		throw lastError ?? new Error(`Failed to connect to ${url} after ${maxReconnectAttempts + 1} attempts`)
	}

	/**
	 * Single WebSocket connection attempt with 10-second timeout.
	 */
	function tryConnect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				ws = new WebSocket(url)
			} catch (err) {
				reject(err)
				return
			}

			// Connection timeout: reject if WebSocket doesn't open within 10 seconds.
			// This prevents hanging forever when the target server is not yet listening
			// (e.g., Devtool WebSocket server still starting up).
			const timeout = setTimeout(() => {
				const err = new Error(`WebSocket connection timeout to ${url}`)
				onerror?.(err)
				reject(err)
				ws?.close()
			}, 10_000)

			ws.on("open", () => {
				clearTimeout(timeout)
				resolve()
			})

			ws.on("message", (data: Buffer) => {
				try {
					const message = JSON.parse(data.toString())
					onmessage?.(message)
				} catch (err) {
					onerror?.(err as Error)
				}
			})

			ws.on("close", () => {
				clearTimeout(timeout)
				onclose?.()
				// Only auto-reconnect if we were ever connected successfully.
				// This prevents reconnect loops when the initial connection fails
				// (e.g., devtools server not yet listening).
				if (wasEverConnected) {
					scheduleReconnect()
				}
			})

			ws.on("error", (err: Error) => {
				clearTimeout(timeout)
				onerror?.(err)
				reject(err) // CRITICAL: reject the start promise so connectToServer catch block runs
			})
		})
	}

	function scheduleReconnect(): void {
		if (isReconnecting || reconnectAttempts >= maxReconnectAttempts) {
			return
		}
		isReconnecting = true
		const delay = reconnectDelay * Math.pow(2, reconnectAttempts)
		console.log(
			`[WebSocketClientTransport] Scheduling reconnect attempt ${reconnectAttempts + 1}/${maxReconnectAttempts} in ${delay}ms`,
		)
		reconnectTimer = setTimeout(async () => {
			reconnectAttempts++
			isReconnecting = false
			try {
				await start()
				console.log(`[WebSocketClientTransport] Reconnected successfully after ${reconnectAttempts} attempt(s)`)
			} catch (err) {
				console.error(
					`[jabberwock] [WebSocketClientTransport] Reconnect attempt ${reconnectAttempts} failed:`,
					err,
				)
			}
		}, delay)
	}

	async function send(message: unknown): Promise<void> {
		if (!ws) {
			throw new Error("WebSocket not connected")
		}
		ws.send(JSON.stringify(message))
	}

	async function close(): Promise<void> {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer)
			reconnectTimer = null
		}
		isReconnecting = false
		reconnectAttempts = maxReconnectAttempts // Prevent reconnect after explicit close
		ws?.close()
		ws = null
	}

	return {
		get onclose() {
			return onclose
		},
		set onclose(v: (() => void) | undefined) {
			onclose = v
		},
		get onerror() {
			return onerror
		},
		set onerror(v: ((error: Error) => void) | undefined) {
			onerror = v
		},
		get onmessage() {
			return onmessage
		},
		set onmessage(v: ((message: unknown) => void) | undefined) {
			onmessage = v
		},
		start,
		send,
		close,
	}
}

export type WebSocketClientTransport = ReturnType<typeof WebSocketClientTransport>
