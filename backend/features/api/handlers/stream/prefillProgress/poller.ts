/**
 * Prefill progress poller — samples the provider's prefill progress on an
 * interval and broadcasts it to the webview(s) until the first token arrives.
 *
 * Lifecycle:
 *   - `start()` is called when the API stream begins (after the request is
 *     dispatched, before the first chunk). It polls every ~500ms.
 *   - `stop()` is called on the first chunk, on stream end, or on error.
 *
 * The broadcast reuses the same direct-postMessage exception as `streamChunk`
 * (see sendStreamChunk.ts) — prefill progress is a low-frequency, ephemeral
 * signal that should not flow through the IntentBus.
 */

import { sendPrefillProgress } from "@features/api/events/actions"
import type { IPrefillProgressSource } from "./source"

const POLL_INTERVAL_MS = 500

/**
 * Active poller handle. The caller owns the returned handle and must call
 * `stop()` when the stream ends.
 */
export interface PrefillProgressPoller {
	stop(): void
}

/**
 * Create and start a poller for the given task, or `null` when the provider
 * cannot report prefill progress.
 */
export function startPrefillProgressPolling(
	taskId: string,
	source: IPrefillProgressSource | null,
): PrefillProgressPoller | null {
	if (!source) return null

	let timer: ReturnType<typeof setInterval> | null = null
	let stopped = false
	let lastSent: number | null = null

	const poll = async (): Promise<void> => {
		if (stopped) return
		const raw = await source.getPercent()
		if (stopped) return
		// -1 = "no progress signal" (indeterminate). A real stop is signalled by
		// the poller stopping + the backend sending an explicit null percent.
		const percent = raw === null ? -1 : raw
		// Only broadcast on change to avoid redundant postMessage traffic.
		if (percent === lastSent) return
		lastSent = percent
		try {
			sendPrefillProgress({ taskId, percent })
		} catch (err) {
			console.warn("[prefillProgress] broadcast failed:", err)
		}
	}

	void poll()
	timer = setInterval(() => void poll(), POLL_INTERVAL_MS)

	return {
		stop(): void {
			if (timer) {
				clearInterval(timer)
				timer = null
			}
			if (stopped) return
			stopped = true
			// Signal the webview that prefill is over (generation started or the
			// stream ended) so it clears the progress and falls back to "Thinking".
			try {
				sendPrefillProgress({ taskId, percent: null })
			} catch (err) {
				console.warn("[prefillProgress] stop broadcast failed:", err)
			}
		},
	}
}
