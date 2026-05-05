/**
 * Shared types for the DOM interaction module.
 *
 * These types are used across serialization, lookup, iframe communication,
 * and all action handlers extracted from DevtoolProvider.tsx.
 */

/**
 * Context passed to every DOM action handler.
 * Contains the postMessage function for sending results back to the extension
 * host, plus iframe communication utilities that are created per-component-instance.
 */
export interface DomHandlerContext {
	postMessage: (msg: unknown) => void
	pendingIframeRequests: Map<string, { resolve: (result: unknown) => void; reject: (err: Error) => void }>
	sendToIframe: (iframe: HTMLIFrameElement, msg: Record<string, unknown>) => void
	queryIframe: (iframe: HTMLIFrameElement, msg: Record<string, unknown>) => Promise<unknown>
	resolveSelectorInIframe: (selector: string) => Promise<{ iframe: HTMLIFrameElement; innerSelector: string } | null>
}

/**
 * Shape of incoming action messages from the extension host.
 * All DOM tool calls are sent as { type: "action", action: "xxx", requestId, ...params }.
 */
export interface DomRequest {
	requestId: string
	type?: string
	action?: string
	[key: string]: unknown
}

/**
 * Response shape from an iframe after a dom-query or dom-action message.
 */
export interface DomIframeResponse {
	requestId: string
	result?: unknown
	error?: string
	html?: string
	commandResult?: string
	commandError?: string
}
