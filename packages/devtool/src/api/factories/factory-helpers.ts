import type { DiagnosticLog } from "@jabberwock/types"

/**
 * Provider interface that must be implemented by the consumer (e.g., the VS Code extension).
 */
export interface DevtoolBridgeProvider {
	findElement: (selector: string, depth?: number, maxChildren?: number, command?: string) => Promise<string>
	getActivePage: (requestId: string) => void
	setActivePageRequestCallback: (requestId: string, callback: (result: string, connector?: string) => void) => void
	setDomRequestCallback: (requestId: string, callback: (result: string, connector?: string) => void) => void
	postMessageToWebview: (type: string, payload?: Record<string, unknown>) => void
	getModes: () => string[]
	getMode: () => string
	getTaskWithId?: (taskId: string) => Record<string, unknown> | undefined
	/**
	 * Execute a host command in the extension host (D4g-2 batch 1). Extension mode backs this with
	 * `vscode.commands.executeCommand`; server mode leaves it absent (the devtool bridge is not
	 * instantiated there).
	 */
	executeCommand?: (command: string, args?: unknown) => Promise<void>
	/**
	 * Host extension version for the devtool `getExtensionInfo` tool (D4g-2 batch 1). Extension mode
	 * backs this with `vscode.extensions.getExtension(...).packageJSON.version`; server mode leaves
	 * it absent (the tool reports the "dev" fallback).
	 */
	getExtensionVersion?: () => string | undefined
}

/**
 * Detect the known-benign Node.js inspector bug "Missing dataLength in event".
 *
 * This is thrown from `node:internal/inspector/network_http` → `broadcastToFrontend`
 * (node:inspector) when the inspector session (DebugMCP / `--inspect`) tries to
 * broadcast an HTTP network event whose body `data` frame lacks a `dataLength`.
 * It is a Node runtime bug, NOT an application error: it does not indicate a
 * problem in Jabberwock or the devtool, and it does not affect extension behavior.
 *
 * Without this guard the global handler logs it as a scary `[devtool] Uncaught
 * Exception` ERROR, which pollutes the diagnostics console and misleads debugging.
 */
function isBenignInspectorDataLengthError(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	const message = error.message ?? ""
	if (!message.includes("Missing dataLength in event")) return false
	const stack = error.stack ?? ""
	return stack.includes("node:inspector") || stack.includes("network_http")
}

export function registerGlobalErrorHandlers(): void {
	process.on("unhandledRejection", (reason: unknown) => {
		if (isBenignInspectorDataLengthError(reason)) {
			// Known Node inspector bug — intentionally ignored (benign, no app impact).
			return
		}
		console.error("[devtool] Unhandled Rejection:", reason)
	})
	process.on("uncaughtException", (error: Error) => {
		if (isBenignInspectorDataLengthError(error)) {
			// Known Node inspector bug — intentionally ignored (benign, no app impact).
			return
		}
		console.error("[devtool] Uncaught Exception:", error)
	})
}

let requestCounter = 0
export function nextRequestId(): string {
	return `devtool-req-${++requestCounter}`
}

/**
 * Result of a DOM query: the raw result string plus the connector id of the
 * surface that answered ("vscode" | "web"), stamped by the frontend connector.
 */
export interface DomQueryResult {
	result: string
	connector?: string
}

export function sendDomQuery(
	provider: DevtoolBridgeProvider,
	type: string,
	payload: Record<string, unknown> = {},
): Promise<DomQueryResult> {
	const requestId = nextRequestId()
	return new Promise<DomQueryResult>((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`DOM query "${type}" timed out after 30s`))
		}, 30_000)
		provider.setDomRequestCallback(requestId, (result: string, connector?: string) => {
			clearTimeout(timeout)
			resolve({ result, connector })
		})
		provider.postMessageToWebview("action", { action: type, requestId, ...payload })
	})
}

/**
 * Format a single diagnostic log entry as a single console line. Shared by
 * `filterBackendLogs` (this file) and `createStateMethods.getLogs`
 * (`factory-state.ts`) so the `[timestamp][LEVEL] message` shape lives in one
 * place (see `local/no-duplicated-logic`).
 */
export function formatLogLine(entry: DiagnosticLog): string {
	const timestamp = new Date(entry.timestamp).toISOString()
	return `[${timestamp}][${entry.level.toUpperCase()}] ${entry.message}`
}

/**
 * Return the last `count` entries of `items`, in reverse order (newest first).
 * Shared pagination tail used by `filterBackendLogs` and `getLogs`.
 */
export function tailReversed<T>(items: T[], count: number): T[] {
	const endIndex = items.length
	const startIndex = Math.max(0, endIndex - count)
	return items.slice(startIndex, endIndex).reverse()
}

/**
 * Filter and paginate backend console logs by level and search text.
 */
export function filterBackendLogs(
	allLogs: DiagnosticLog[],
	level?: string,
	search?: string,
	limit = 10,
	cursor = 0,
): { lines: string[]; totalLines: number } {
	let filtered = allLogs
	if (level) {
		const normalizedLevel = level === "info" ? ("info" as const) : (level as "warn" | "error" | "debug")
		filtered = filtered.filter((e) => e.level === normalizedLevel)
	}
	if (search) {
		const searchLower = search.toLowerCase()
		filtered = filtered.filter((e) => e.message.toLowerCase().includes(searchLower))
	}
	const totalLines = filtered.length
	// Window ending `cursor` entries before the tail.
	const window = filtered.slice(0, Math.max(0, filtered.length - cursor))
	// Newest FIRST: the agent expects the last N entries to be the most recent ones.
	const lines = window
		.slice(Math.max(0, window.length - limit))
		.slice()
		.reverse()
		.map(formatLogLine)
	return { lines, totalLines }
}
