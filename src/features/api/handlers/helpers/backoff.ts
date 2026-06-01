import delay from "delay"

import type { StreamHandle, AttemptApiRequestCallbacks } from "../../../chat/task/condense/actions/types"

const MAX_EXPONENTIAL_BACKOFF_SECONDS = 600 // 10 minutes

/**
 * Apply shared exponential backoff and countdown UX for auto-retry.
 */
export async function backoffAndAnnounce(
	task: StreamHandle,
	callbacks: AttemptApiRequestCallbacks,
	retryAttempt: number,
	error: { status?: number; message?: string; errorDetails?: Array<{ [key: string]: unknown }> },
): Promise<void> {
	try {
		const baseDelay = 5

		let exponentialDelay = Math.min(
			Math.ceil(baseDelay * Math.pow(2, retryAttempt)),
			MAX_EXPONENTIAL_BACKOFF_SECONDS,
		)

		// Respect provider rate limit window
		let rateLimitDelay = 0
		const rateLimit =
			((task.apiConfiguration as { [key: string]: unknown } | undefined)?.rateLimitSeconds as number) || 0
		const lastReqTime = task.lastApiRequestTime
		if (lastReqTime && rateLimit > 0) {
			const elapsed = performance.now() - lastReqTime
			rateLimitDelay = Math.ceil(Math.min(rateLimit, Math.max(0, rateLimit * 1000 - elapsed) / 1000))
		}

		// Prefer RetryInfo on 429 if present
		if (error?.status === 429) {
			const retryInfo = (error?.errorDetails as Array<{ [key: string]: unknown }> | undefined)?.find(
				(d) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
			)
			const match = (retryInfo?.retryDelay as string | undefined)?.match(/^(\d+)s$/)
			if (match) {
				exponentialDelay = Number(match[1]) + 1
			}
		}

		const finalDelay = Math.max(exponentialDelay, rateLimitDelay)
		if (finalDelay <= 0) {
			return
		}

		// Build header text; fall back to error message if none provided
		let headerText
		if (error.status) {
			// Include both status code (for ChatRow parsing) and detailed message (for error details)
			// Format: "<status>\n<message>" allows ChatRow to extract status via parseInt(text.substring(0,3))
			// while preserving the full error message in errorDetails for debugging
			const errorMessage = error?.message || "Unknown error"
			headerText = `${error.status}\n${errorMessage}`
		} else if (error?.message) {
			headerText = error.message
		} else {
			headerText = "Unknown error"
		}

		headerText = headerText ? `${headerText}\n` : ""

		// Show countdown timer with exponential backoff
		for (let i = finalDelay; i > 0; i--) {
			// Check abort flag during countdown to allow early exit
			if (task._state.abort) {
				throw new Error(`[Task#${task.taskId}] Aborted during retry countdown`)
			}

			await callbacks.say(
				"api_req_retry_delayed",
				`${headerText}<retry_timer>${i}</retry_timer>`,
				undefined,
				true,
			)
			await delay(1000)
		}

		await callbacks.say("api_req_retry_delayed", headerText, undefined, false)
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)

		if (task._state.abort && message.includes("Aborted during retry countdown")) {
			return
		}

		console.error("[jabberwock] Exponential backoff failed:", err)
	}
}
