/**
 * Webview store bridge — a generic function for handling devtool store queries
 * and console log queries from the extension host.
 *
 * When the devtool MCP server needs to inspect the frontend MST store, it sends
 * a `storeQuery` message to the webview via postMessage. This function sets up
 * a `window.addEventListener("message", ...)` handler that:
 *
 * 1. Receives `storeQuery` messages (type "action" or "storeQuery")
 * 2. Dispatches to the appropriate action handler (getRootSnapshot, getActionBuffer, applySnapshot,
 *    getConsoleLogs, searchConsole)
 * 3. Sends the result back as a `domResponse` message
 *
 * The function is generic — it uses MST's built-in `getSnapshot()` and `applySnapshot()`
 * for the standard operations, and accepts an optional `getActionBuffer` callback for
 * project-specific action buffer retrieval.
 *
 * Console log queries (getConsoleLogs, searchConsole) are handled in the webview
 * via the in-memory log buffer maintained by initWebviewConsoleBridge().
 *
 * Usage (in webview App.tsx):
 * ```tsx
 * import { createWebviewStoreBridge } from "@jabberwock/devtool"
 * import { getFrontendActionBuffer } from "./features/root-store"
 *
 * createWebviewStoreBridge(rootStore, vscode.postMessage.bind(vscode), {
 *   getActionBuffer: getFrontendActionBuffer,
 * })
 * ```
 */

import { getWebviewConsoleLogs } from "../../webview/console.js"
import { getSnapshot, applySnapshot } from "mobx-state-tree"

export interface WebviewStoreBridgeOptions {
	/**
	 * Optional callback for retrieving the action buffer.
	 * This is project-specific and cannot be generically implemented
	 * by the devtool package.
	 */
	getActionBuffer?: () => unknown[]
}

/**
 * Set up a window message listener that handles devtool store queries
 * and console log queries.
 *
 * @param rootStore - The MST root store instance (used with getSnapshot/applySnapshot)
 * @param postMessage - A function to send messages back to the extension host
 * @param options - Optional project-specific callbacks
 * @returns A cleanup function to remove the event listener
 */
export function createWebviewStoreBridge(
	rootStore: unknown,
	postMessage: (msg: unknown) => void,
	options?: WebviewStoreBridgeOptions,
): () => void {
	const postDomResponse = (requestId: string, text: string): void => {
		postMessage({
			type: "domResponse",
			requestId,
			text,
		})
	}

	async function handleStoreAction(message: Record<string, unknown>): Promise<void> {
		const action = message.action as string
		const requestId = message.requestId as string

		if (!requestId) return

		switch (action) {
			case "getRootSnapshot":
				return handleGetRootSnapshot(requestId)
			case "getActionBuffer":
				return handleGetActionBuffer(requestId)
			case "applySnapshot":
				return handleApplySnapshot(requestId, message)
			case "getConsoleLogs":
				return handleConsoleQuery(requestId, message)
			case "searchConsole":
				return handleConsoleQuery(requestId, message, true)
			default:
				postDomResponse(requestId, JSON.stringify({ error: `Unknown action: ${action}` }))
		}
	}

	async function handleGetRootSnapshot(requestId: string): Promise<void> {
		const snapshot = getSnapshot(rootStore as never)
		postDomResponse(requestId, JSON.stringify(snapshot))
	}

	function handleGetActionBuffer(requestId: string): void {
		const buffer = options?.getActionBuffer?.() ?? []
		postDomResponse(requestId, JSON.stringify(buffer))
	}

	async function handleApplySnapshot(requestId: string, message: Record<string, unknown>): Promise<void> {
		const snapshot = message.snapshot as Record<string, unknown>
		if (snapshot) {
			applySnapshot(rootStore as never, snapshot)
			postDomResponse(requestId, JSON.stringify({ success: true }))
		} else {
			postDomResponse(requestId, JSON.stringify({ error: "No snapshot provided" }))
		}
	}

	function handleConsoleQuery(requestId: string, message: Record<string, unknown>, isSearch = false): void {
		const level = message.level as string | undefined
		const limit = (message.limit as number) ?? 10
		const cursor = (message.cursor as number) ?? 0
		const query = isSearch ? (message.query as string) : (message.search as string | undefined)
		const result = getWebviewConsoleLogs(level, limit, cursor, query)
		postDomResponse(requestId, result)
	}

	function handleStoreQuery(e: MessageEvent): void {
		const message = e.data as Record<string, unknown>
		console.log(
			`[devtool] [STORE_QUERY] Received message: type=${message.type} action=${message.action} req=${message.requestId}`,
		)
		if ((message.type !== "action" && message.type !== "storeQuery") || !message.requestId) {
			console.log(
				`[devtool] [STORE_QUERY] SKIP: type=${message.type} (need action/storeQuery) req=${!!message.requestId}`,
			)
			return
		}

		const action = message.action as string
		const knownActions = ["getRootSnapshot", "getActionBuffer", "applySnapshot", "getConsoleLogs", "searchConsole"]
		if (knownActions.includes(action)) {
			console.log(`[devtool] [STORE_QUERY] PROCESSING: action=${action} req=${message.requestId}`)
			handleStoreAction(message).catch((err: unknown) => {
				console.error("[devtool] [STORE_QUERY] Error:", err)
				postDomResponse(message.requestId as string, JSON.stringify({ error: String(err) }))
			})
		} else {
			console.log(`[devtool] [STORE_QUERY] SKIP: unknown action=${action}`)
		}
	}

	window.addEventListener("message", handleStoreQuery)
	return () => window.removeEventListener("message", handleStoreQuery)
}
