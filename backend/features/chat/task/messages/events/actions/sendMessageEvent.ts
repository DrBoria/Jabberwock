/**
 * Message event action creators.
 *
 * These are the ONLY code paths that may send message-related events
 * to the webview via postMessageToWebview. No other code may import or call
 * postMessageToWebview, postStateToWebview, or postStateToWebviewWithoutTaskHistory directly.
 */

import type { Notification } from "@jabberwock/types"

import { getProvider } from "@features/foundation/webview/providerRegistry"
import {
	postMessageToWebview,
	postStateToWebview,
	postStateToWebviewWithoutTaskHistory,
} from "@features/foundation/window-manager/store"

/**
 * Notify the webview that a message was updated.
 */
export function sendMessageUpdated(message: Notification): void {
	const provider = getProvider()
	postMessageToWebview(provider, { type: "messageUpdated", message })
}

/**
 * Push current state to the webview (excluding task history for performance).
 */
export function sendStateWithoutTaskHistory(): void {
	const provider = getProvider()
	void postStateToWebviewWithoutTaskHistory(provider)
}

/**
 * Push current full state to the webview (includes task history).
 */
export function sendStateToWebview(): void {
	const provider = getProvider()
	void postStateToWebview(provider)
}
