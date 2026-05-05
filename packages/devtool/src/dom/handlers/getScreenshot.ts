/**
 * getScreenshot action handler — not supported in webview context.
 */
import type { DomHandlerContext } from "../types.js"

export function handleGetScreenshot(ctx: DomHandlerContext, req: Record<string, unknown>): void {
	const { postMessage } = ctx
	const requestId = req.requestId as string

	postMessage({ type: "domResponse", requestId, text: "Screenshot not supported in this context" })
}
