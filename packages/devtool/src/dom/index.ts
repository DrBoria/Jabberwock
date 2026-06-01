/**
 * DOM interaction module — the public entry point.
 *
 * Provides `createDomMessageHandler` which returns a `(e: MessageEvent) => void`
 * function that handles all DOM interaction messages from the extension host:
 *   - findElement    — query and serialize DOM by CSS selector
 *   - runCommand     — execute arbitrary JS in the webview console
 *   - clickElement   — click an element (native .click() + pointer event chain)
 *   - scrollElement  — scroll an element by direction
 *   - typeText       — type text into an input/textarea/contenteditable
 *   - selectOption   — select a dropdown option
 *   - getScreenshot  — not supported in webview (returns placeholder)
 *   - dragElement    — drag an element in a direction
 *   - dragFromTo     — drag from one coordinate to another
 *   - getActivePage  — return current window location (hash/pathname)
 *   - getConsoleLogs — return console log entries (from in-memory log buffer)
 *   - searchConsole  — search console log entries
 *   - dom-response   — internal: resolves pending iframe queries
 *   - getRootSnapshot — return MST root store snapshot
 *   - getActionBuffer — return action log entries
 *   - applySnapshot   — apply MST snapshot
 *
 * Usage:
 *   import { createDomMessageHandler } from "../dom/index.js"
 *   const onMessage = useMemo(() => createDomMessageHandler(postMessage, rootStore, { getActionBuffer }), [postMessage, rootStore])
 *   useEffect(() => { window.addEventListener("message", onMessage); return () => window.removeEventListener("message", onMessage) }, [onMessage])
 */
import type { DomHandlerContext } from "./types.js"
import { createIframeContext, handleDomResponse } from "./iframe.js"
import { handleFindElement } from "./handlers/findElement.js"
import { handleRunCommand } from "./handlers/runCommand.js"
import { handleClickElement } from "./handlers/clickElement.js"
import { handleTypeText } from "./handlers/typeText.js"
import { handleScrollElement } from "./handlers/scrollElement.js"
import { handleSelectOption } from "./handlers/selectOption.js"
import { handleGetScreenshot } from "./handlers/getScreenshot.js"
import { handleDragElement, handleDragFromTo } from "./handlers/drag.js"
import { handleGetActivePage } from "./handlers/getActivePage.js"
import { getWebviewConsoleLogs } from "../webview/console.js"

/**
 * Options for store query handlers within the DOM message handler.
 */
export interface StoreQueryOptions {
	/** Optional callback for retrieving the action buffer. */
	getActionBuffer?: () => unknown[]
}

/**
 * Map of action names to handler functions.
 *
 * Each handler receives a DomHandlerContext and the raw message payload,
 * and is responsible for calling ctx.postMessage with the result.
 */
const actionHandlers: Record<string, (ctx: DomHandlerContext, req: Record<string, unknown>) => void | Promise<void>> = {
	findElement: handleFindElement,
	runCommand: handleRunCommand,
	clickElement: handleClickElement,
	typeText: handleTypeText,
	scrollElement: handleScrollElement,
	selectOption: handleSelectOption,
	getScreenshot: handleGetScreenshot,
	dragElement: handleDragElement,
	dragFromTo: handleDragFromTo,
}

/**
 * Create store query handlers that can be merged into the action handlers map.
 * These require access to the MST rootStore and optional callbacks.
 */
function createStoreQueryHandlers(
	rootStore: unknown,
	options?: StoreQueryOptions,
): Record<string, (ctx: DomHandlerContext, req: Record<string, unknown>) => void | Promise<void>> {
	return {
		getConsoleLogs: (_ctx, req) => {
			const level = req.level as string | undefined
			const limit = (req.limit as number) ?? 10
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
			const cursor = (req.cursor as number) ?? 0
			const result = getWebviewConsoleLogs(level, limit, cursor, query)
			_ctx.postMessage({
				type: "domResponse",
				requestId: req.requestId as string,
				text: result,
			})
		},

		getRootSnapshot: async (_ctx, req) => {
			const { getSnapshot } = await import("mobx-state-tree")
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
			const { applySnapshot } = await import("mobx-state-tree")
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

// ── Webview Store Bridge (optional, kept for backward compatibility) ──
export { createWebviewStoreBridge } from "./webview-store-bridge.js"
export type { WebviewStoreBridgeOptions } from "./webview-store-bridge.js"

export function createDomMessageHandler(
	postMessage: (msg: unknown) => void,
	rootStore?: unknown,
	options?: StoreQueryOptions,
): (e: MessageEvent) => void {
	const ctx = createIframeContext(postMessage)

	// Merge DOM action handlers with store query handlers (if rootStore provided)
	const handlers = { ...actionHandlers }
	if (rootStore) {
		const storeHandlers = createStoreQueryHandlers(rootStore, options)
		Object.assign(handlers, storeHandlers)
	}

	// DEBUG: Log available handler keys
	console.log(
		`[devtool] [DEBUG:DOMHANDLER] createDomMessageHandler: rootStore=${typeof rootStore} keys=${Object.keys(handlers).join(",")}`,
	)

	let msgCount = 0
	return (e: MessageEvent) => {
		const message = e.data as Record<string, unknown>
		msgCount++
		const msgType = message.type as string
		const msgAction = message.action as string
		const msgReqId = message.requestId as string

		// ── dom-response (from iframe content after dom-query/dom-action) ──
		if (message.type === "dom-response") {
			console.log(`[DEBUG:DOMHANDLER] #${msgCount} dom-response: req=${msgReqId}`)
			handleDomResponse(ctx, message)
			return
		}

		// ── getActivePage (special: returns activePageResponse, not domResponse) ──
		if (message.type === "action" && message.action === "getActivePage") {
			console.log(`[DEBUG:DOMHANDLER] #${msgCount} getActivePage: req=${msgReqId}`)
			handleGetActivePage(ctx, message)
			return
		}

		// All other actions require type="action" and a requestId
		if (message.type !== "action" || !message.requestId) {
			if (message.type !== "state" && message.type !== "theme") {
				console.log(
					`[DEBUG:DOMHANDLER] #${msgCount} SKIP (not action or no requestId): type=${msgType} action=${msgAction} req=${msgReqId}`,
				)
			}
			return
		}

		const action = message.action as string
		const handler = handlers[action]
		if (handler) {
			console.log(`[DEBUG:DOMHANDLER] #${msgCount} ROUTING: action=${action} req=${msgReqId}`)
			try {
				const result = handler(ctx, message)
				// Handle async handlers (e.g. handleFindElement, getRootSnapshot)
				if (result instanceof Promise) {
					result.catch((err: unknown) => {
						console.error(
							`[devtool] [DEBUG:DOMHANDLER] #${msgCount} async handler error for action=${action}:`,
							err,
						)
						ctx.postMessage({
							type: "domResponse",
							requestId: msgReqId,
							text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
						})
					})
				}
			} catch (err) {
				console.error(`[devtool] [DEBUG:DOMHANDLER] #${msgCount} handler error for action=${action}:`, err)
				ctx.postMessage({
					type: "domResponse",
					requestId: msgReqId,
					text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
				})
			}
		} else {
			console.warn(`[devtool] [DEBUG:DOMHANDLER] #${msgCount} NO HANDLER for action=${action} req=${msgReqId}`)
		}
	}
}

// ── Frontend Bridge (extension-side, generic) ──────────────────────
export { registerDomResponseHandler } from "./register-dom-response-handler.js"
export { createFrontendBridge } from "./create-frontend-bridge.js"
export type { CreateFrontendBridgeOptions } from "./create-frontend-bridge.js"
