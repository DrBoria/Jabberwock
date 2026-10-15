/**
 * DOM-query plumbing shared by the orchestrator and the concrete methods
 * builder: request ids, the webview round-trip, and the global error handlers
 * that keep known-benign Node inspector noise out of the diagnostics console.
 */
import type { DevtoolBridgeProvider } from "./server.js"

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
 * Detect the known-benign Node.js inspector bug "Missing dataLength in event".
 *
 * This is thrown from `node:internal/inspector/network_http` → `broadcastToFrontend`
 * (node:inspector) when the inspector session (DebugMCP / `--inspect`) tries to
 * broadcast an HTTP network event whose body `data` frame lacks a `dataLength`.
 * It is a Node runtime bug, NOT an application error.
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
