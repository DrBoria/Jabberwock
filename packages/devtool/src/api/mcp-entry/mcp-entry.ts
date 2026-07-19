#!/usr/bin/env node

import * as net from "net"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { DevtoolClient } from "../../client.js"
import { getBuildTimestamp } from "../http-server.js"
import { registerAllTools } from "./schemas.js"

const WS_PORT = 60060
const HTTP_STATUS_PORT = 60061

/**
 * Fast polling interval for checking if the extension host is available.
 * Used with AbortSignal.timeout() so each HTTP fetch times out fast when
 * the extension host is frozen at a breakpoint.
 */
const POLL_INTERVAL_MS = 200

/**
 * Maximum number of poll attempts before giving up.
 * 8 attempts × 200ms = ~1.6s fast path for "not running" detection.
 * When extension is at breakpoint, each fetch times out at 200ms →
 * 8 × (200ms timeout) + 7 × (200ms wait) ≈ 3.4s worst case.
 */
const MAX_POLL_ATTEMPTS = 8

/**
 * Guard timer as safety net. If neither ensureConnection nor the tool call
 * complete within this time, we return BREAKPOINT_ACTIVE. Set to 6s to
 * allow the slowest poll cycle (~3.4s) + WebSocket connect (~1-2s) to
 * complete for the breakpoint case via connection-type detection first.
 */
const BREAKPOINT_GUARD_TIMEOUT_MS = 10_000

let client: DevtoolClient

/**
 * Result of polling the extension host's HTTP status server.
 */
const EXTENSION_STATUS = {
	AVAILABLE: "available",
	NOT_RUNNING: "not_running",
	BREAKPOINT: "breakpoint",
} as const

type ExtensionStatus = (typeof EXTENSION_STATUS)[keyof typeof EXTENSION_STATUS]

/**
 * Check if a TCP port is open by attempting a raw socket connection.
 * This is more reliable than inspecting fetch() error causes, because
 * Node.js's undici fetch implementation wraps connection refused errors
 * inconsistently when combined with AbortSignal.timeout().
 *
 * Returns true if the port accepts connections (extension is running or
 * frozen at breakpoint), false if port is closed (extension not running).
 */

/**
 * Small delay helper.
 */
function delay(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms))
}

function isPortOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new net.Socket()
		socket.setTimeout(timeoutMs)
		socket.on("connect", () => {
			socket.destroy()
			resolve(true)
		})
		socket.on("error", () => {
			socket.destroy()
			resolve(false)
		})
		socket.on("timeout", () => {
			socket.destroy()
			resolve(false)
		})
		socket.connect(port, host)
	})
}

/**
 * Check if the extension is available (HTTP status responds OK).
 * Returns true if extension is running and responsive.
 */
async function checkExtensionStatus(timeoutMs: number): Promise<boolean> {
	try {
		const response = await fetch(`http://127.0.0.1:${HTTP_STATUS_PORT}/status`, {
			signal: AbortSignal.timeout(timeoutMs),
		})
		if (response.ok) {
			const data = await response.json()
			console.error(
				`[devtools] Extension available (build: ${data.buildTimestamp}, uptime: ${Math.floor(data.uptime)}s)`,
			)
			return true
		}
	} catch {
		// HTTP fetch failed (timeout, abort, etc.) — extension may be busy or at breakpoint
	}
	return false
}

/**
 * Poll the extension host's HTTP status server to check if it's running.
 *
 * Uses a two-step detection:
 * 1. Raw TCP socket check — definitively determines if port is open/closed
 * 2. If port is open, HTTP fetch with AbortSignal.timeout distinguishes
 *    "running" (200 response) from "breakpoint" (timeout/no response)
 *
 * - Extension NOT running: TCP connection refused → fast path (< 1s)
 * - Extension at BREAKPOINT: TCP connects, but fetch times out → ~3.4s
 * - Extension RUNNING: TCP connects, fetch returns 200 → fast path
 */
async function pollExtensionStatus(maxAttempts: number = MAX_POLL_ATTEMPTS): Promise<ExtensionStatus> {
	const result = await fastPollExtensionStatus(maxAttempts)
	if (result !== null) {
		return result
	}
	return retryPollExtensionStatus()
}

/**
 * Phase 1: Fast polling with short timeouts.
 * Quickly detects "not running" (TCP refused) and "available" (HTTP 200).
 * Returns null if port was open but HTTP never responded — caller should retry.
 */
async function fastPollExtensionStatus(maxAttempts: number): Promise<ExtensionStatus | null> {
	let sawConnectionRefused = false
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const portOpen = await isPortOpen("127.0.0.1", HTTP_STATUS_PORT, POLL_INTERVAL_MS)
		if (!portOpen) {
			sawConnectionRefused = true
		} else if (await checkExtensionStatus(POLL_INTERVAL_MS)) {
			return EXTENSION_STATUS.AVAILABLE
		}
		if (attempt < maxAttempts) {
			await delay(POLL_INTERVAL_MS)
		}
	}
	if (sawConnectionRefused) {
		return EXTENSION_STATUS.NOT_RUNNING
	}
	return null
}

/**
 * Phase 2: Port was open but HTTP never responded.
 * The extension might be BUSY (generating) rather than at a breakpoint.
 * Retry with longer timeouts to give a busy extension time to respond.
 */
async function retryPollExtensionStatus(): Promise<ExtensionStatus> {
	console.error("[devtools] HTTP status unresponsive after fast poll, retrying with longer timeout...")
	const LONG_RETRY_ATTEMPTS = 3
	const LONG_RETRY_TIMEOUT_MS = 1_000
	const LONG_RETRY_INTERVAL_MS = 500
	for (let attempt = 1; attempt <= LONG_RETRY_ATTEMPTS; attempt++) {
		if (await checkExtensionStatus(LONG_RETRY_TIMEOUT_MS)) {
			return EXTENSION_STATUS.AVAILABLE
		}
		if (attempt < LONG_RETRY_ATTEMPTS) {
			await delay(LONG_RETRY_INTERVAL_MS)
		}
	}
	return EXTENSION_STATUS.BREAKPOINT
}

async function ensureConnection(): Promise<void> {
	// Fast path: WebSocket is already connected → skip HTTP polling.
	// Once the WebSocket is established, polling the HTTP status server
	// (which runs in the same extension process) is redundant and slow.
	// During generation, the event loop may delay HTTP responses, causing
	// false-positive BREAKPOINT_ACTIVE detections.
	if (client?.isConnected) {
		return
	}

	// Slow path: need to establish or re-establish connection
	const status = await pollExtensionStatus()

	if (status === EXTENSION_STATUS.NOT_RUNNING) {
		throw new Error("DISCONNECTED: Extension is not running. Launch the extension and retry.")
	}

	if (status === EXTENSION_STATUS.BREAKPOINT) {
		throw new Error(
			"BREAKPOINT_ACTIVE: Extension host is paused at a breakpoint. Release the breakpoint and retry.",
		)
	}

	// Extension is available — connect WebSocket
	if (!client) {
		client = new DevtoolClient({ port: WS_PORT })
	}

	try {
		await client.connect()
		console.error("[devtools] Connected to extension WebSocket MCP server")
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.error("[devtools] Failed to connect:", msg)
		// Connection refused on WS port = extension not running
		if (/econnrefused|connection refused|connect ECONN|websocket closed/i.test(msg)) {
			throw new Error("DISCONNECTED: Extension is not running. Launch the extension and retry.")
		}
		throw new Error(
			`BREAKPOINT_ACTIVE: Extension host is paused at a breakpoint (${msg}). Release the breakpoint and retry.`,
		)
	}
}

/**
 * Check if the extension is genuinely at a breakpoint by probing the HTTP
 * status port. The HTTP status server runs in the same extension process —
 * if it responds, the extension is alive (just busy generating), not frozen.
 *
 * Returns true if the extension IS at a breakpoint (status port unresponsive),
 * false if the extension is alive but busy.
 */
async function checkHttpStatusIsBreakpoint(): Promise<boolean> {
	try {
		const response = await fetch(`http://127.0.0.1:${HTTP_STATUS_PORT}/status`, {
			signal: AbortSignal.timeout(1_000),
		})
		if (response.ok) {
			// Extension is alive — not at a breakpoint
			return false
		}
	} catch {
		// HTTP request failed — extension is either at a breakpoint or crashed
	}
	// Port not responding — genuinely at a breakpoint
	return true
}

/**
 * Handle a timed-out tool call: check if extension is at a breakpoint
 * or just busy (generating). If busy, retry the call once.
 */
async function handleTimeoutRetry(name: string, args: Record<string, unknown>): Promise<string> {
	const isBreakpoint = await checkHttpStatusIsBreakpoint()
	if (isBreakpoint) {
		throw new Error(
			"BREAKPOINT_ACTIVE: Extension host is paused at a breakpoint. Release the breakpoint and retry.",
		)
	}
	console.error("[devtools] Extension busy (generating), retrying tool call...")
	const result = await client.callTool(name, args)
	return typeof result === "string" ? result : JSON.stringify(result)
}

/**
 * Handle a general tool call error: reconnect and retry once.
 */
async function handleReconnectRetry(name: string, args: Record<string, unknown>): Promise<string> {
	await ensureConnection()
	const result = await client.callTool(name, args)
	return typeof result === "string" ? result : JSON.stringify(result)
}

/**
 * Handle errors from proxyToolCall's catch block.
 */
async function handleToolCallError(error: unknown, name: string, args: Record<string, unknown>): Promise<string> {
	const message = error instanceof Error ? error.message : String(error)

	if (message.startsWith("BREAKPOINT_ACTIVE")) {
		throw error
	}

	if (message.startsWith("DISCONNECTED")) {
		throw error
	}

	console.error(`[devtools] Tool call failed: ${name}`, error)

	if (message.includes("timed out") && client?.isConnected) {
		return handleTimeoutRetry(name, args)
	}

	return handleReconnectRetry(name, args)
}

export async function proxyToolCall(name: string, args: Record<string, unknown> = {}): Promise<string> {
	// Guard timer for the ensureConnection phase only.
	// During connection setup, a short timeout quickly detects breakpoints.
	// Once connected, the tool call is covered by the client's own 30s timeout
	// (client.ts:119), which properly distinguishes busy-extension (slow but alive)
	// from breakpoint-frozen (connection drops or never responds).
	let guardTimer: ReturnType<typeof setTimeout> | null = null
	const guardPromise = new Promise<never>((_, reject) => {
		guardTimer = setTimeout(
			() =>
				reject(
					new Error(
						"BREAKPOINT_ACTIVE: Extension host is paused at a breakpoint (guard timeout). Release the breakpoint and retry.",
					),
				),
			BREAKPOINT_GUARD_TIMEOUT_MS,
		)
	})

	try {
		await Promise.race([ensureConnection(), guardPromise])
		clearTimeout(guardTimer!)
		guardTimer = null

		// Tool call — no guard timer. The client's own 30s request timeout
		// handles unresponsive extensions. During generation, webview-bound
		// tools (find_element, etc.) may take >10s to respond without being
		// at a breakpoint — the guard timer caused false positives here.
		const result = await client.callTool(name, args)
		return typeof result === "string" ? result : JSON.stringify(result)
	} catch (error) {
		clearTimeout(guardTimer!)
		return handleToolCallError(error, name, args)
	}
}

async function main() {
	const banner = `
╔══════════════════════════════════════╗
║  Jabberwock DevTools (Stdio)         ║
║  Build: ${getBuildTimestamp()}         ║
╚══════════════════════════════════════╝`
	console.error(banner)

	const server = new McpServer({
		name: "jabberwock-devtools",
		version: "1.0.0",
	})

	registerAllTools(server, proxyToolCall)

	const transport = new StdioServerTransport()
	console.error("[devtools] Starting stdio MCP server...")
	await server.connect(transport)
	console.error("[devtools] Stdio MCP server ready")
}

main().catch((err) => {
	console.error("[devtools] Fatal error:", err)
	process.exit(1)
})
