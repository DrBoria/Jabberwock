/**
 * Condense context event action creators.
 *
 * These are the ONLY code paths that may send condense-related events
 * to the webview via postMessageToWebview. No other code may import or call
 * postMessageToWebview directly.
 */

import { getProvider } from "@features/foundation/webview/providerRegistry"
import { postMessageToWebview } from "@features/foundation/window-manager/store"

/**
 * Notify the webview that condense context has started.
 */
export function sendCondenseTaskContextStarted(taskId: string): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "condenseTaskContextStarted", text: taskId })
}

/**
 * Notify the webview that condense context has completed.
 */
export function sendCondenseTaskContextResponse(taskId: string): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "condenseTaskContextResponse", text: taskId })
}
