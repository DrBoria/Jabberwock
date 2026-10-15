/**
 * Frontend message interceptor.
 *
 * Mirrors the backend {@link MessageInterceptor} but lives in the webview and
 * intercepts the FRONTEND→BACKEND direction: it wraps the webview's
 * `postMessage` channel (the {@link PostMessageFn} transport), so every message
 * the frontend sends to the extension host is checked against the active
 * interceptors, traced, and can be short-circuited with a canned response.
 *
 * The pure matching/trace logic is shared with the backend — this class only
 * adds the browser-side transport hook. It is browser-safe (no `vscode` import):
 * the transport is injected by the caller (e.g. `vscode.postMessage`).
 */
import { MessageInterceptor, type TraceEntry, type TraceFilter } from "../../mcp/interceptor/index.js"

/** A function that delivers a message from the frontend to the backend host. */
export type PostMessageFn = (message: unknown) => void

export class FrontendMessageInterceptor extends MessageInterceptor {
	private readonly postMessage: PostMessageFn

	constructor(postMessage: PostMessageFn) {
		super()
		this.postMessage = postMessage
	}

	/**
	 * Send a message to the backend through the interceptor. If a send-direction
	 * interceptor matches, the message is traced and NOT delivered to the host;
	 * the canned `response` is returned instead. Otherwise the message is
	 * delivered as-is.
	 */
	send(message: { type?: string; action?: string }): { intercepted: boolean; response?: unknown } {
		const result = this.sendMessage(message)
		if (!result.intercepted) {
			this.postMessage(message)
		}
		return result
	}

	/**
	 * Convenience accessor for the trace as a newest-first, paginated page.
	 * The raw trace is oldest-first, so this reverses it before slicing.
	 */
	getTracePage(filter?: TraceFilter, limit = 10, cursor = 0): { entries: TraceEntry[]; totalCount: number } {
		const { entries, totalCount } = this.getTrace(filter)
		const newestFirst = entries.slice().reverse()
		return {
			entries: newestFirst.slice(cursor, cursor + limit),
			totalCount,
		}
	}
}

/**
 * Create a frontend interceptor wired to the given transport.
 */
export function createFrontendInterceptor(postMessage: PostMessageFn): FrontendMessageInterceptor {
	return new FrontendMessageInterceptor(postMessage)
}
