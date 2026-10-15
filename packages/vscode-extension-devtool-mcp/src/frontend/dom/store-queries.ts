import type { DomHandlerContext } from "./types.js"
import { getWebviewConsoleLogs } from "../console/index.js"
import { getSnapshot, applySnapshot } from "mobx-state-tree"
import { resolveNestedPath, resolvePath } from "../../stores/mobx/snapshot/tree.js"

/**
 * Options for store query handlers within the DOM message handler.
 */
export interface StoreQueryOptions {
	/** Optional callback for retrieving the action buffer. */
	getActionBuffer?: () => unknown[]
}

/**
 * Set up a window message listener that handles devtool store queries
 * (getRootSnapshot, getActionBuffer, applySnapshot) and console log queries
 * (getConsoleLogs, searchConsole) sent from the extension host as
 * `action` / `storeQuery` messages, replying with `domResponse`.
 *
 * Usage (in webview App.tsx):
 * ```tsx
 * createWebviewStoreBridge(rootStore, vscode.postMessage.bind(vscode), {
 *   getActionBuffer: getFrontendActionBuffer,
 * })
 * ```
 *
 * @param rootStore - The MST root store instance (used with getSnapshot/applySnapshot)
 * @param postMessage - A function to send messages back to the extension host
 * @param options - Optional project-specific callbacks
 * @returns A cleanup function to remove the event listener
 */
export function createWebviewStoreBridge(
	rootStore: unknown,
	postMessage: (msg: unknown) => void,
	options?: StoreQueryOptions,
): () => void {
	const postDomResponse = (requestId: string, text: string): void => {
		postMessage({ type: "domResponse", requestId, text })
	}

	const handlers = createStoreQueryHandlers(rootStore, options)
	const ctx: DomHandlerContext = {
		postMessage,
		pendingIframeRequests: new Map(),
		sendToIframe: () => {},
		queryIframe: async () => undefined,
		resolveSelectorInIframe: async () => null,
	}

	function handleStoreQuery(e: MessageEvent): void {
		const message = e.data as Record<string, unknown>
		// NOTE: do NOT log every message here — this handler receives ALL window
		// messages, including every streamChunk/messageUpdated during LLM streaming
		// (thousands per stream). Logging each one floods the webview console buffer
		// and freezes the webview. Only log when actually processing a known action.
		if ((message.type !== "action" && message.type !== "storeQuery") || !message.requestId) {
			return
		}

		const action = message.action as string
		const handler = handlers[action]
		if (handler) {
			console.log(`[devtool] [STORE_QUERY] PROCESSING: action=${action} req=${message.requestId}`)
			Promise.resolve(handler(ctx, message)).catch((err: unknown) => {
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

/**
 * Create store query handlers that can be merged into the action handlers map.
 */
export function createStoreQueryHandlers(
	rootStore: unknown,
	options?: StoreQueryOptions,
): Record<string, (ctx: DomHandlerContext, req: Record<string, unknown>) => void | Promise<void>> {
	return {
		getConsoleLogs: (_ctx, req) => {
			const level = req.level as string | undefined
			const limit = (req.limit as number) ?? 10
			if (limit > 10) {
				_ctx.postMessage({
					type: "domResponse",
					requestId: req.requestId as string,
					text: JSON.stringify({ lines: [], totalLines: 0, error: `Limit cannot exceed 10, got ${limit}` }),
				})
				return
			}
			const cursor = (req.cursor as number) ?? 0
			const search = req.search as string | undefined
			const result = getWebviewConsoleLogs(level, limit, cursor, search)
			_ctx.postMessage({
				type: "domResponse",
				requestId: req.requestId as string,
				text: result,
			})
		},

		searchConsole: (_ctx, req) => {
			const query = req.query as string
			const level = req.level as string | undefined
			const limit = (req.limit as number) ?? 10
			if (limit > 10) {
				_ctx.postMessage({
					type: "domResponse",
					requestId: req.requestId as string,
					text: JSON.stringify({ lines: [], totalLines: 0, error: `Limit cannot exceed 10, got ${limit}` }),
				})
				return
			}
			const cursor = (req.cursor as number) ?? 0
			const result = getWebviewConsoleLogs(level, limit, cursor, query)
			_ctx.postMessage({
				type: "domResponse",
				requestId: req.requestId as string,
				text: result,
			})
		},

		getRootSnapshot: async (_ctx, req) => {
			const snapshot = getSnapshot(rootStore as never)
			_ctx.postMessage({
				type: "domResponse",
				requestId: req.requestId as string,
				text: JSON.stringify(snapshot),
			})
		},

		getNestedStoreState: async (_ctx, req) => {
			const store = req.store as string
			const path = req.path as string | undefined
			const snapshot = getSnapshot(rootStore as never)

			const storeData = resolveNestedPath(snapshot as Record<string, unknown>, store)
			if (storeData === undefined) {
				_ctx.postMessage({
					type: "domResponse",
					requestId: req.requestId as string,
					text: JSON.stringify({ error: `Store "${store}" not found` }),
				})
				return
			}

			let result: unknown
			if (path) {
				result = resolvePath(storeData as Record<string, unknown>, path)
				if (result === undefined) {
					_ctx.postMessage({
						type: "domResponse",
						requestId: req.requestId as string,
						text: JSON.stringify({ error: `Path "${path}" not found in store "${store}"` }),
					})
					return
				}
			} else {
				result = storeData
			}

			_ctx.postMessage({
				type: "domResponse",
				requestId: req.requestId as string,
				text: JSON.stringify(result),
			})
		},

		getActionBuffer: (_ctx, req) => {
			const buffer = options?.getActionBuffer?.() ?? []
			_ctx.postMessage({
				type: "domResponse",
				requestId: req.requestId as string,
				text: JSON.stringify(buffer),
			})
		},

		applySnapshot: async (_ctx, req) => {
			const snapshot = req.snapshot as Record<string, unknown>
			if (snapshot) {
				applySnapshot(rootStore as never, snapshot)
				_ctx.postMessage({
					type: "domResponse",
					requestId: req.requestId as string,
					text: JSON.stringify({ success: true }),
				})
			} else {
				_ctx.postMessage({
					type: "domResponse",
					requestId: req.requestId as string,
					text: JSON.stringify({ error: "No snapshot provided" }),
				})
			}
		},
	}
}
