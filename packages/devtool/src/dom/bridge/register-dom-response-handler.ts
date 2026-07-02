/**
 * Generic domResponse handler registration for the extension host.
 *
 * The webview sends messages of type `"domResponse"` back to the extension host
 * in response to `storeQuery` messages (getRootSnapshot, getActionBuffer,
 * applySnapshot). These messages contain a `requestId` and `text` payload.
 *
 * This function registers a handler for the `"domResponse"` message type on the
 * webview message routing system, extracting the `requestId` and `text` and
 * forwarding them to the provided `resolveDomRequest` callback.
 *
 * The function is fully generic — it works with any extension that has:
 * 1. A webview message routing system with an `onWebviewMessage(type, handler)` registrar
 * 2. A `resolveDomRequest(requestId, result)` callback resolution mechanism
 *
 * Usage (in extension host):
 * ```ts
 * import { registerDomResponseHandler } from "@jabberwock/devtool"
 *
 * registerDomResponseHandler(
 *   (type, handler) => onWebviewMessage(type, handler),
 *   (requestId, result) => myStore.resolveDomRequest(requestId, result),
 * )
 * ```
 */
export function registerDomResponseHandler(
	onWebviewMessage: (type: string, handler: (provider: unknown, message: Record<string, unknown>) => void) => void,
	resolveDomRequest: (requestId: string, result: string) => void,
): void {
	onWebviewMessage("domResponse", (_provider: unknown, message: Record<string, unknown>) => {
		const requestId = message.requestId as string
		const text = message.text as string
		if (requestId && text !== undefined) {
			resolveDomRequest(requestId, text)
		}
	})
}
