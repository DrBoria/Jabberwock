/**
 * Webview Console Bridge — intercepts console.log/warn/error/debug and forwards
 * them as webviewLog messages to the extension host for diagnostics.
 *
 * Also maintains an in-memory buffer of captured logs so the devtool's
 * get_console_logs MCP tool can retrieve them via DOM query.
 *
 * Originally from webview-ui/src/features/devtools/utils/webviewConsoleBridge.ts,
 * moved into @jabberwock/devtool so the package is self-contained.
 */

import { vscode } from "./vscode.js"

const originalConsole = {
	log: console.log.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	debug: console.debug.bind(console),
}

const LOG_METHODS = ["log", "warn", "error", "debug"] as const

// ── In-memory console log buffer ──────────────────────────────────────────
interface LogEntry {
	level: string
	text: string
	timestamp: number
}

const MAX_BUFFER_SIZE = 5000
const logBuffer: LogEntry[] = []

const serializeArg = (arg: unknown) => {
	if (arg instanceof Error) return arg.stack || arg.message
	if (typeof arg === "object" && arg !== null) {
		if ("displayName" in arg && typeof arg.displayName === "string") return `<${arg.displayName}>`
		if ("name" in arg && typeof arg.name === "string") return `<${arg.name}>`
		if ("$$typeof" in arg) return "[React Element]"
		try {
			return JSON.stringify(arg)
		} catch {
			return String(arg)
		}
	}
	return String(arg)
}

/**
 * Initialize the webview console bridge.
 * Call this once at app startup to intercept console methods.
 */
export function initWebviewConsoleBridge() {
	LOG_METHODS.forEach((method) => {
		const original = originalConsole[method]
		Object.defineProperty(console, method, {
			value: (...args: unknown[]) => {
				original(...args)

				try {
					let messageStr = ""
					if (typeof args[0] === "string" && args[0].includes("%s")) {
						let formatStr = args[0]
						const formatArgs = args.slice(1)
						formatArgs.forEach((arg) => {
							formatStr = formatStr.replace("%s", serializeArg(arg))
						})
						messageStr = formatStr
					} else {
						messageStr = args.map(serializeArg).join(" ")
					}

					// Store in buffer for devtool retrieval
					logBuffer.push({ level: method, text: messageStr, timestamp: Date.now() })
					// Trim oldest entries when buffer exceeds max size
					if (logBuffer.length > MAX_BUFFER_SIZE) {
						logBuffer.splice(0, logBuffer.length - MAX_BUFFER_SIZE)
					}

					vscode.postMessage({
						type: "webviewLog",
						text: `[WEBVIEW][${method.toUpperCase()}] ${messageStr}`,
					} as never)
				} catch {
					// Serialization safety — never break the caller
				}
			},
			writable: true,
			configurable: true,
		})
	})
}

/**
 * Retrieve captured console logs from the in-memory buffer.
 * Supports optional filtering by log level, text search, and cursor-based pagination.
 *
 * @param level - Optional log level filter ("log", "warn", "error", "debug")
 * @param limit - Maximum number of entries to return (default: 10, from end)
 * @param cursor - Number of entries to skip from the end (default: 0)
 * @param search - Optional text search filter (case-insensitive substring match)
 * @returns JSON string with { lines, totalLines }
 */
export function getWebviewConsoleLogs(level?: string, limit: number = 10, cursor: number = 0, search?: string): string {
	let entries = logBuffer

	// Filter by level if specified
	// Map "info" (MCP convention) to "log" (console.log/stored level)
	if (level) {
		const normalizedLevel = level === "info" ? "log" : level
		entries = entries.filter((e) => e.level === normalizedLevel)
	}

	// Filter by search text (case-insensitive)
	if (search) {
		const searchLower = search.toLowerCase()
		entries = entries.filter((e) => e.text.toLowerCase().includes(searchLower))
	}

	const totalLines = entries.length

	// Paginate from the end (most recent first) using cursor-based pagination
	const endIndex = entries.length - cursor
	const startIndex = Math.max(0, endIndex - limit)
	const sliced = entries.slice(startIndex, endIndex).reverse()

	const lines = sliced.map((e) => {
		const timestamp = new Date(e.timestamp).toISOString()
		return `[${timestamp}][${e.level.toUpperCase()}] ${e.text}`
	})

	return JSON.stringify({ lines, totalLines })
}

/**
 * Clear the in-memory console log buffer.
 */
export function clearWebviewConsoleLogs(): void {
	logBuffer.length = 0
}
