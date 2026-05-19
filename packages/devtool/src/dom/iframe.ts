/**
 * Iframe communication utilities.
 *
 * Provides postMessage-based query/response communication with cross-origin
 * iframes embedded in the webview. The iframe content must handle "dom-query"
 * (for reading DOM) and "dom-action" (for triggering interactions) messages.
 */
import type { DomHandlerContext } from "./types.js"
import { findAllElementsBySelector } from "./lookup.js"

// ── Context Factory ──────────────────────────────────────────────────────

/**
 * Create a DomHandlerContext with fresh iframe communication state.
 *
 * Each component instance gets its own context so that pending iframe
 * requests don't leak across re-mounts.
 *
 * @param postMessage - The function to send results back to the extension host
 * @returns A DomHandlerContext with iframe utilities
 */
export function createIframeContext(postMessage: (msg: unknown) => void): DomHandlerContext {
	const pendingIframeRequests = new Map<
		string,
		{ resolve: (result: unknown) => void; reject: (err: Error) => void }
	>()

	const sendToIframe = (iframe: HTMLIFrameElement, msg: Record<string, unknown>): void => {
		try {
			iframe.contentWindow?.postMessage(msg, "*")
		} catch {
			// Ignore cross-origin postMessage errors
		}
	}

	const queryIframe = (iframe: HTMLIFrameElement, msg: Record<string, unknown>): Promise<unknown> => {
		return new Promise<unknown>((resolve, reject) => {
			const rid = `dom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
			pendingIframeRequests.set(rid, { resolve, reject })
			sendToIframe(iframe, { ...msg, requestId: rid })
			setTimeout(() => {
				if (pendingIframeRequests.has(rid)) {
					pendingIframeRequests.delete(rid)
					reject(new Error(`Timeout waiting for iframe response`))
				}
			}, 3000)
		})
	}

	const resolveSelectorInIframe = async (
		selector: string,
	): Promise<{ iframe: HTMLIFrameElement; innerSelector: string } | null> => {
		// Check if selector starts with an iframe qualifier (e.g., "iframe[src*='...'] button")
		const iframeMatch = selector.match(/^(iframe[^\s]*)\s+(.+)$/)
		if (iframeMatch) {
			const iframeSelector = iframeMatch[1]!
			const innerSelector = iframeMatch[2]!
			const iframeEl = findAllElementsBySelector(iframeSelector)[0] as HTMLIFrameElement | undefined
			if (iframeEl && iframeEl.tagName?.toLowerCase() === "iframe") {
				return { iframe: iframeEl, innerSelector }
			}
		}
		return null
	}

	return { postMessage, pendingIframeRequests, sendToIframe, queryIframe, resolveSelectorInIframe }
}

// ── dom-response Handler ───────────────────────────────────────────────

/**
 * Handle a "dom-response" message from an iframe.
 *
 * Resolves the pending promise in the iframe request map so that
 * `queryIframe` callers get their result.
 */
export function handleDomResponse(ctx: DomHandlerContext, message: Record<string, unknown>): void {
	const requestId = String(message.requestId ?? "")
	const pending = ctx.pendingIframeRequests.get(requestId)
	if (pending) {
		if (message.error) {
			pending.reject(new Error(String(message.error)))
		} else {
			pending.resolve(message.result)
		}
		ctx.pendingIframeRequests.delete(requestId)
	}
}
