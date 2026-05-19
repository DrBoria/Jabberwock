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
 *   - dom-response   — internal: resolves pending iframe queries
 *
 * Usage:
 *   import { createDomMessageHandler } from "../dom/index.js"
 *   const onMessage = useMemo(() => createDomMessageHandler(postMessage), [postMessage])
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
	// Store query actions — these have no-op handlers here because they are
	// handled directly in App.tsx where rootStore is available. The no-op
	// prevents "NO HANDLER" warnings in the console.
	getStoreSnapshot: async (_ctx, _req) => {
		/* handled in App.tsx */
	},
	getStoreActions: async (_ctx, _req) => {
		/* handled in App.tsx */
	},
	filterStoreState: async (_ctx, _req) => {
		/* handled in App.tsx */
	},
	filterStoreActions: async (_ctx, _req) => {
		/* handled in App.tsx */
	},
	searchStoreActions: async (_ctx, _req) => {
		/* handled in App.tsx */
	},
	countStoreActions: async (_ctx, _req) => {
		/* handled in App.tsx */
	},
	applyStoreSnapshot: async (_ctx, _req) => {
		/* handled in App.tsx */
	},
}

/**
 * Create a window message event handler that processes all DOM interaction
 * messages from the extension host.
 *
 * @param postMessage - The function to send response messages back to the extension
 * @returns A (e: MessageEvent) => void handler suitable for window.addEventListener("message", ...)
 */
export function createDomMessageHandler(postMessage: (msg: unknown) => void): (e: MessageEvent) => void {
	const ctx = createIframeContext(postMessage)

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
		const handler = actionHandlers[action]
		if (handler) {
			console.log(`[DEBUG:DOMHANDLER] #${msgCount} ROUTING: action=${action} req=${msgReqId}`)
			handler(ctx, message)
		} else {
			console.warn(`[DEBUG:DOMHANDLER] #${msgCount} NO HANDLER for action=${action} req=${msgReqId}`)
		}
	}
}
