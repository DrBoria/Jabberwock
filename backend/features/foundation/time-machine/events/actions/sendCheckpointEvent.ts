/**
 * Checkpoint event action creators.
 *
 * These are the ONLY code paths that may send checkpoint-related events
 * to the webview via postMessageToWebview. No other code may import or call
 * postMessageToWebview directly.
 */

import { getProvider } from "@features/foundation/webview/providerRegistry"
import { postMessageToWebview } from "@features/foundation/window-manager/store"

/**
 * Send a checkpoint initialization warning to the webview.
 */
export function sendCheckpointInitWarning(type?: "WAIT_TIMEOUT" | "INIT_TIMEOUT", timeout?: number): void {
	const provider = getProvider()
	postMessageToWebview(provider, {
		type: "checkpointInitWarning",
		checkpointWarning: type && timeout ? { type, timeout } : undefined,
	})
}

/**
 * Notify the webview that the current checkpoint was updated.
 */
export function sendCurrentCheckpointUpdated(text: string, suppressMessage?: boolean): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "currentCheckpointUpdated", text, suppressMessage })
}
