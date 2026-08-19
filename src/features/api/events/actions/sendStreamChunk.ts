/**
 * STREAMING EXCEPTION — sends raw stream chunks via direct postMessage().
 *
 * This is the SINGLE documented exception to the architecture rule that
 * "local handlers NEVER call EventBridge.postMessage() directly".
 *
 * Why it exists:
 *   1. VS Code's only IPC channel between Extension Host and Webview is postMessage()
 *   2. API responses arrive 1-5 bytes at a time — dispatching an Intent per byte
 *      would spam the MST store with thousands of updates
 *   3. Debounce/heartbeat approaches cause visual jerking in the UI
 *
 * See plans/architectural-restructure-v2.md §Streaming Architecture
 */

import { getProvider } from "@features/foundation/webview/providerRegistry"
import { postMessageToWebview } from "@features/foundation/window-manager/store"

/**
 * Send a raw stream chunk to the webview, bypassing EventConstants and IntentBus.
 *
 * Uses EventBridge's postMessageToWebview internally via the window-manager store,
 * because EventBridge stores the webview view reference.
 *
 * @param payload - Streaming payload with taskId and accumulated text
 */
export function sendStreamChunk(payload: { taskId: string; text: string; reset?: boolean }): void {
	const provider = getProvider()
	postMessageToWebview(provider, {
		type: "streamChunk",
		taskId: payload.taskId,
		text: payload.text,
		reset: payload.reset,
	})
}
