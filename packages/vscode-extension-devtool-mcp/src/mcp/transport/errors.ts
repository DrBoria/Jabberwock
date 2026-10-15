/**
 * Shared transport error/timeout/retry policy for all three channels (ws, http,
 * stdio). Keeping these in one place means the ws server, the HTTP status
 * server and the stdio entry all agree on what "a breakpoint" and "not running"
 * look like, and on how long to wait before giving up.
 *
 * Also owns the extension-host reachability probes: the fixed ports, the
 * TCP/HTTP checks and the poll → long-retry → breakpoint decision used by the
 * stdio entry before it opens a WebSocket to the extension host.
 */

import * as net from "node:net"

// ── Fixed ports ───────────────────────────────────────────────────────────────

/** WebSocket MCP port the extension host listens on. */
export const WS_PORT = 60060

/** HTTP status port the extension host listens on. */
export const HTTP_STATUS_PORT = 60061

// ── Polling / timeouts ────────────────────────────────────────────────────────

/**
 * Fast polling interval for probing the extension host's HTTP status port.
 * Used with AbortSignal.timeout() so each HTTP fetch times out fast when the
 * extension host is frozen at a breakpoint.
 */
export const POLL_INTERVAL_MS = 200

/**
 * Maximum number of fast-poll attempts before falling back to long retries.
 * 8 attempts × 200ms = ~1.6s fast path for "not running" detection.
 */
export const MAX_POLL_ATTEMPTS = 8

/**
 * Long-retry parameters: the port was open but HTTP never responded. The
 * extension might be BUSY (generating) rather than at a breakpoint.
 */
export const LONG_RETRY_ATTEMPTS = 3
export const LONG_RETRY_TIMEOUT_MS = 1_000
export const LONG_RETRY_INTERVAL_MS = 500

/**
 * Guard timer as a safety net for the stdio entry's ensureConnection phase.
 * If the connection setup does not complete within this time, we surface
 * BREAKPOINT_ACTIVE. Set to 10s to allow the slowest poll cycle (~3.4s) +
 * WebSocket connect (~1-2s).
 */
export const BREAKPOINT_GUARD_TIMEOUT_MS = 10_000

/** Default per-request timeout for the stdio client (ms). */
export const CLIENT_REQUEST_TIMEOUT_MS = 30_000

/** Auto-reconnect delay for the stdio client (ms). */
export const CLIENT_RECONNECT_DELAY_MS = 1_000

// ── Error formats ─────────────────────────────────────────────────────────────

/**
 * Canonical error messages. The stdio entry rethrows these verbatim so the
 * agent can distinguish a paused-at-breakpoint host from a dead one.
 */
export const ERR = {
	DISCONNECTED: "DISCONNECTED: Extension is not running. Launch the extension and retry.",
	BREAKPOINT_ACTIVE: "BREAKPOINT_ACTIVE: Extension host is paused at a breakpoint. Release the breakpoint and retry.",
} as const

/**
 * Result of polling the extension host's HTTP status server.
 */
export const EXTENSION_STATUS = {
	AVAILABLE: "available",
	NOT_RUNNING: "not_running",
	BREAKPOINT: "breakpoint",
} as const

export type ExtensionStatus = (typeof EXTENSION_STATUS)[keyof typeof EXTENSION_STATUS]

/** Check whether an error is an EADDRINUSE (port already taken). */
export function isEaddrinuse(err: unknown): boolean {
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
export function backoff(_attempt: number): number {
	return 50
}

/** Promise-based sleep. */
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ── Reachability probes ───────────────────────────────────────────────────────

/**
 * Probe a TCP port with a short-lived socket. Resolves true when the port
 * accepts connections, false on connection refused / timeout.
 */
export function isPortOpen(host: string, port: number, timeoutMs = 500): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new net.Socket()
		const done = (ok: boolean) => {
			socket.destroy()
			resolve(ok)
		}
		socket.setTimeout(timeoutMs)
		socket.once("connect", () => done(true))
		socket.once("timeout", () => done(false))
		socket.once("error", () => done(false))
		socket.connect(port, host)
	})
}

/**
 * Fetch the extension host's /status endpoint. A successful response means the
 * host is alive and responsive; a failure (timeout, connection refused, non-2xx)
 * means it is paused (breakpoint) or absent.
 */
export async function checkExtensionStatus(timeoutMs = POLL_INTERVAL_MS): Promise<boolean> {
	try {
		const res = await fetch(`http://127.0.0.1:${HTTP_STATUS_PORT}/status`, {
			signal: AbortSignal.timeout(timeoutMs),
		})
		return res.ok
	} catch {
		return false
	}
}

/**
 * Fast poll: probe the TCP port, then confirm via HTTP. Distinguishes
 * "not running" (port refused) from "frozen" (port open, HTTP silent).
 */
export async function fastPollExtensionStatus(maxAttempts = MAX_POLL_ATTEMPTS): Promise<ExtensionStatus | null> {
	let sawConnectionRefused = false
	for (let i = 0; i < maxAttempts; i++) {
		const open = await isPortOpen("127.0.0.1", HTTP_STATUS_PORT)
		if (!open) {
			sawConnectionRefused = true
		} else if (await checkExtensionStatus()) {
			return EXTENSION_STATUS.AVAILABLE
		}
		await sleep(POLL_INTERVAL_MS)
	}
	return sawConnectionRefused ? EXTENSION_STATUS.NOT_RUNNING : null
}

/**
 * Long retry: the port was open but HTTP never answered. A few more attempts
 * with a larger per-request timeout before concluding the host is at a
 * breakpoint.
 */
export async function retryPollExtensionStatus(): Promise<ExtensionStatus> {
	for (let i = 0; i < LONG_RETRY_ATTEMPTS; i++) {
		if (await checkExtensionStatus(LONG_RETRY_TIMEOUT_MS)) {
			return EXTENSION_STATUS.AVAILABLE
		}
		await sleep(LONG_RETRY_INTERVAL_MS)
	}
	return EXTENSION_STATUS.BREAKPOINT
}

/**
 * Full status poll: fast poll first, long retry on an inconclusive result.
 */
export async function pollExtensionStatus(maxAttempts = MAX_POLL_ATTEMPTS): Promise<ExtensionStatus> {
	const fast = await fastPollExtensionStatus(maxAttempts)
	if (fast !== null) return fast
	return retryPollExtensionStatus()
}
