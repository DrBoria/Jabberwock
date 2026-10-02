/**
 * Renderer console capture via Chrome DevTools Protocol (CDP).
 *
 * The VS Code workbench renderer and the VS Code surface iframe each run in their
 * OWN Electron renderer process; their console output (e.g. "Webview fatal
 * error: Could not register service worker") is NEVER delivered to the extension
 * host, so the only reliable way to read it is CDP.
 *
 * The Extension Development Host window is launched with
 * `--remote-debugging-port=9223` (see .vscode/launch.json). This module connects
 * to the BROWSER-level CDP endpoint, enables Target auto-attach (flatten
 * sessions) so it picks up the workbench page AND the VS Code surface iframe as
 * they appear, and buffers Runtime/Log console events into a ring buffer.
 * `getRendererConsole()` reads that buffer.
 *
 * It runs in the stdio MCP proxy (a plain long-lived Node process), independent
 * of the extension host — it keeps capturing even when the host is frozen at a
 * breakpoint.
 *
 * Event parsing and the ring buffer live in `cdp-console-buffer.ts`.
 */
import WebSocket from "ws"
import { CdpConsoleBuffer } from "./cdp-console-buffer.js"

const CDP_HTTP_PORT = 9223
const CDP_HTTP_BASE = `http://127.0.0.1:${CDP_HTTP_PORT}`
const RETRY_MS = 3000

const events = new CdpConsoleBuffer((data) => conn?.ws.send(data))
let conn: { ws: WebSocket } | undefined
let connecting = false
let stopped = false

function onSocketClose(): void {
	if (stopped) return
	conn = undefined
	events.clear()
	// Reconnect after a short delay (the window may have been reloaded).
	setTimeout(() => {
		if (!stopped) void connect()
	}, RETRY_MS)
}

async function connect(): Promise<boolean> {
	if (connecting || stopped) return false
	connecting = true
	try {
		const res = await fetch(`${CDP_HTTP_BASE}/json/version`, { signal: AbortSignal.timeout(2000) })
		if (!res.ok) {
			connecting = false
			return false
		}
		const data = (await res.json()) as { webSocketDebuggerUrl?: string }
		const wsUrl = data.webSocketDebuggerUrl
		if (!wsUrl) {
			connecting = false
			return false
		}
		const ws = new WebSocket(wsUrl)
		conn = { ws }

		const openTimeout = setTimeout(() => {
			try {
				ws.close()
			} catch {
				// ignore
			}
		}, 4000)

		ws.on("open", () => {
			clearTimeout(openTimeout)
			connecting = false
			// Discover + auto-attach to all current and future targets.
			ws.send(JSON.stringify({ id: 1, method: "Target.setDiscoverTargets", params: { discover: true } }))
			ws.send(
				JSON.stringify({
					id: 2,
					method: "Target.setAutoAttach",
					params: { autoAttach: true, waitForDebuggerOnStart: false, flatten: true },
				}),
			)
		})
		ws.on("message", (data) => events.handleWsMessage(data))
		ws.on("close", () => {
			clearTimeout(openTimeout)
			connecting = false
			onSocketClose()
		})
		ws.on("error", () => {
			clearTimeout(openTimeout)
			connecting = false
		})
		return true
	} catch {
		connecting = false
		return false
	}
}

/**
 * Start the CDP renderer-console listener. Retries in the background until the
 * Extension Development Host window (launched with --remote-debugging-port) is
 * reachable. Safe to call multiple times.
 */
export function startRendererConsoleListener(): void {
	if (stopped) return
	void (async () => {
		// Try immediately, then keep retrying in the background.
		for (let attempt = 0; attempt < 200; attempt++) {
			const ok = await connect()
			if (ok) {
				// Once connected, onSocketClose drives reconnection. Stop the
				// startup retry loop; only reconnect on close.
				return
			}
			await new Promise((r) => setTimeout(r, RETRY_MS))
		}
	})()
}

export function stopRendererConsoleListener(): void {
	stopped = true
	try {
		conn?.ws.close()
	} catch {
		// ignore
	}
	conn = undefined
}

/**
 * Read the buffered renderer console. Newest first, with cursor/limit
 * pagination and optional level/search filters.
 */
export function getRendererConsole(opts: { level?: string; search?: string; limit?: number; cursor?: number }): string {
	const { level, search, limit = 10, cursor = 0 } = opts
	let entries = events.entries
	if (level) entries = entries.filter((e) => e.level === level)
	if (search) {
		const s = search.toLowerCase()
		entries = entries.filter((e) => e.text.toLowerCase().includes(s))
	}
	const newestFirst = [...entries].reverse()
	const sliced = newestFirst.slice(cursor, cursor + limit)
	const lines = sliced.map(
		(e) => `[${new Date(e.timestamp).toISOString()}][${e.level.toUpperCase()}][${e.target}] ${e.text}`,
	)
	return JSON.stringify({
		lines,
		totalLines: entries.length,
		cdpConnected: !!conn,
		connectedTargets: events.connectedTargets,
		note: conn
			? undefined
			: "CDP not connected — make sure the Extension Development Host window was launched with --remote-debugging-port (Run Extension). Retry in a few seconds.",
	})
}
