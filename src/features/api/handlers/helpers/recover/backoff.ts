import delay from "delay"

import type { StreamHandle, AttemptApiRequestCallbacks } from "@features/chat/task/condense/actions/types"
import { computeRateLimitRemaining } from "@features/api/handlers/helpers/prepare/rateLimit"

const MAX_EXPONENTIAL_BACKOFF_SECONDS = 600

function computeExponentialDelay(retryAttempt: number): number {
	return Math.min(Math.ceil(5 * Math.pow(2, retryAttempt)), MAX_EXPONENTIAL_BACKOFF_SECONDS)
}

function applyRetryInfo(
	error: { status?: number; errorDetails?: Array<{ [key: string]: unknown }> },
	exponentialDelay: number,
): number {
	if (error?.status !== 429) {
		return exponentialDelay
	}
	const retryInfo = (error?.errorDetails as Array<{ [key: string]: unknown }> | undefined)?.find(
		(d) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
	)
	const match = (retryInfo?.retryDelay as string | undefined)?.match(/^(\d+)s$/)
	if (match) {
		return Number(match[1]) + 1
	}
	return exponentialDelay
}

function buildHeaderText(error: { status?: number; message?: string }): string {
	let headerText: string
	if (error.status) {
		const errorMessage = error?.message || "Unknown error"
		headerText = `${error.status}\n${errorMessage}`
	} else if (error?.message) {
		headerText = error.message
	} else {
		headerText = "Unknown error"
	}
	return `${headerText}\n`
}

async function runCountdownLoop(
	task: StreamHandle,
	callbacks: AttemptApiRequestCallbacks,
	finalDelay: number,
	headerText: string,
): Promise<void> {
	for (let i = finalDelay; i > 0; i--) {
		if (task._state.abort) {
			throw new Error(`[Task#${task.taskId}] Aborted during retry countdown`)
		}

		await callbacks.say("api_req_retry_delayed", `${headerText}<retry_timer>${i}</retry_timer>`, undefined, true)
		await delay(1000)
	}

	await callbacks.say("api_req_retry_delayed", headerText, undefined, false)
}

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
		let exponentialDelay = computeExponentialDelay(retryAttempt)
		const rateLimitDelay = computeRateLimitRemaining(task)
		exponentialDelay = applyRetryInfo(error, exponentialDelay)

		const finalDelay = Math.max(exponentialDelay, rateLimitDelay)
		if (finalDelay <= 0) {
			return
		}

		const headerText = buildHeaderText(error)
		await runCountdownLoop(task, callbacks, finalDelay, headerText)
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)

		if (task._state.abort && message.includes("Aborted during retry countdown")) {
			return
		}

		console.error("[jabberwock] Exponential backoff failed:", err)
	}
}
