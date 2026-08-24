/**
 * Task event action creators.
 *
 * These are the ONLY code paths that may send task-related events
 * to the webview via postMessageToWebview. No other code may import or call
 * postMessageToWebview directly.
 */

import { getProvider } from "@features/foundation/webview/providerRegistry"
import { postMessageToWebview } from "@features/foundation/window-manager/store"

/**
 * Send an invoke command to the webview.
 */
export function sendInvoke(invoke: string): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "invoke", invoke })
}

/**
 * Send an action command to the webview.
 */
export function sendAction(action: string): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "action", action })
}

/**
 * Send a generic event to the webview with an arbitrary message payload.
 * Use this for message types that are not covered by a dedicated action creator.
 */
export function sendEvent(message: Record<string, unknown>): void {
	const provider = getProvider()
	postMessageToWebview(provider, message)
}

/**
 * Send a command execution status update.
 */
export function sendCommandExecutionStatus(status: Record<string, unknown>): void {
	const provider = getProvider()
	postMessageToWebview(provider, {
		type: "commandExecutionStatus",
		text: JSON.stringify(status),
	})
}

/**
 * Send a cancel task command to the webview.
 */
export function sendCancelTask(): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "cancelTask" })
}
