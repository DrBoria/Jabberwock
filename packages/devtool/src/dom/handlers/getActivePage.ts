/**
 * getActivePage action handler — returns the current window location path
 * (hash or pathname) for active page detection.
 */
import type { DomHandlerContext } from "../types.js"

export function handleGetActivePage(ctx: DomHandlerContext, message: Record<string, unknown>): void {
	const { postMessage } = ctx
	const req = message as { requestId: string }
	const path = window.location.hash || window.location.pathname || "/"
	postMessage({ type: "activePageResponse", requestId: req.requestId, activePage: path })
}
