/**
 * PREFILL PROGRESS — sends prompt-processing progress to the webview.
 *
 * Follows the same direct-postMessage exception as `sendStreamChunk`:
 * prefill progress is a low-frequency, ephemeral signal (one frame per
 * ~500ms) that should not flow through the IntentBus.
 */

import { getProvider } from "@features/foundation/webview"
import { postMessageToWebview } from "@features/foundation"

/**
 * Send a prefill progress frame to the webview.
 *
 * @param payload - taskId plus the progress in 0-100, `-1` for
 *                  "no progress signal" (indeterminate), or `null` to signal
 *                  that prefill is over (generation started / stream ended).
 */
export function sendPrefillProgress(payload: { taskId: string; percent: number | null }): void {
	const provider = getProvider()
	postMessageToWebview(provider, {
		type: "prefillProgress",
		taskId: payload.taskId,
		percent: payload.percent,
	})
}
