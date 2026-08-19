import delay from "delay"

import type { StreamHandle, AttemptApiRequestCallbacks } from "@features/chat/task/condense/actions/types"

type RateLimitTask = {
	apiConfiguration?: unknown
	lastApiRequestTime?: number
}

/**
 * Get the current profile ID from the MST settings store.
 */
/**
 * Compute remaining rate limit delay for a given task.
 * Shared between pre-request throttle (rateLimit.ts) and post-failure backoff (backoff.ts).
 */
export function computeRateLimitRemaining(task: RateLimitTask): number {
	const rateLimit =
		((task.apiConfiguration as { [key: string]: unknown } | undefined)?.rateLimitSeconds as number) || 0
	if (!rateLimit) {
		return 0
	}
	const lastReqTime = task.lastApiRequestTime
	if (!lastReqTime) {
		return 0
	}
	const elapsed = performance.now() - lastReqTime
	return Math.ceil(Math.min(rateLimit, Math.max(0, rateLimit * 1000 - elapsed) / 1000))
}

/**
 * Enforce the user-configured provider rate limit.
 */
/**
 * Enforce the user-configured provider rate limit.
 */
export async function maybeWaitForProviderRateLimit(
	task: StreamHandle,
	callbacks: AttemptApiRequestCallbacks,
	retryAttempt: number,
): Promise<void> {
	const rateLimitDelay = computeRateLimitRemaining(task)

	// Only show the countdown UX on the first attempt. Retry flows have their own delay messaging.
	if (rateLimitDelay > 0 && retryAttempt === 0) {
		for (let i = rateLimitDelay; i > 0; i--) {
			// Send structured JSON data for i18n-safe transport
			const delayMessage = JSON.stringify({ seconds: i })
			await callbacks.say("api_req_rate_limit_wait", delayMessage, undefined, true)
			await delay(1000)
		}
		// Finalize the partial message so the UI doesn't keep rendering an in-progress spinner.
		await callbacks.say("api_req_rate_limit_wait", undefined, undefined, false)
	}
}
