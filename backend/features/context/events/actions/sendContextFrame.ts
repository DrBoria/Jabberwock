/**
 * Context frame action creator.
 *
 * This is the ONLY code path that may send context-graph response frames to the
 * webview. Frames bypass IntentBus/MST like streamChunk (streaming exception
 * pattern); the connector wraps them in its envelope and resolves targeting per
 * v4 section 6.3. No other code may call postMessageToWebview directly for
 * context frames.
 */

import type { ClientTarget } from "@jabberwock/types"

/**
 * Structural view of a webview-capable provider accepted by the creator below.
 * Assignable from `EventBridge`, `ProviderHandle` and `WebviewProvider`.
 */
export interface WebviewMessageTarget {
	postMessageToWebview(message: Record<string, unknown>, target?: ClientTarget): unknown
}

/**
 * Send a context-graph response frame to the webview, addressed to the
 * requesting client when its id is known, broadcast otherwise.
 *
 * @returns `true` when delivered, `false` when the send failed or the provider
 * reported the target as undeliverable (callers treat this as terminal for the
 * stream [D-stop-on-undeliverable]).
 */
export async function sendContextFrame(
	provider: WebviewMessageTarget,
	frame: Record<string, unknown>,
	target?: ClientTarget,
): Promise<boolean> {
	try {
		const result = await provider.postMessageToWebview(frame, target)
		// Providers report delivery as a boolean; a falsy result means the target is gone.
		return result === undefined ? true : Boolean(result)
	} catch (error) {
		console.error(`[jabberwock] [context-actions] outbound failed for frame type ${String(frame.type)}:`, error)
		return false
	}
}
