import type { DomHandlerContext } from "./types.js"
import { getWebviewConsoleLogs } from "../webview/console.js"
import { getSnapshot, applySnapshot } from "mobx-state-tree"

/**
 * Options for store query handlers within the DOM message handler.
 */
export interface StoreQueryOptions {
	/** Optional callback for retrieving the action buffer. */
	getActionBuffer?: () => unknown[]
}

/**
 * Create store query handlers that can be merged into the action handlers map.
 * These require access to the MST rootStore and optional callbacks.
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
