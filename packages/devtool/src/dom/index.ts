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

	return (e: MessageEvent) => {
		const message = e.data as Record<string, unknown>

		// ── dom-response (from iframe content after dom-query/dom-action) ──
		if (message.type === "dom-response") {
			handleDomResponse(ctx, message)
			return
		}

		// ── getActivePage (special: returns activePageResponse, not domResponse) ──
		if (message.type === "action" && message.action === "getActivePage") {
			handleGetActivePage(ctx, message)
			return
		}

		// All other actions require type="action" and a requestId
		if (message.type !== "action" || !message.requestId) return

		const action = message.action as string
		const handler = actionHandlers[action]
		if (handler) {
			handler(ctx, message)
		}
	}
}
