import { getJabberwockApiUrl } from "../config.ts"
import type { RetryQueue } from "../retry-queue/index.ts"

interface FetchTelemetryOptions {
	authService: { isAuthenticated: () => boolean; getSessionToken: () => string | undefined }
	retryQueue: RetryQueue | null
}

function logFetchError(options: RequestInit, path: string, response: Response): void {
	console.error(`[TelemetryClient#fetch] ${options.method} ${path} -> ${response.status} ${response.statusText}`)
}

async function queueForRetry(
	url: string,
	fetchOptions: RequestInit,
	allowQueueing: boolean,
	response: Response,
	retryQueue: RetryQueue | null,
): Promise<void> {
	if (retryQueue && allowQueueing && (response.status >= 500 || response.status === 429)) {
		await retryQueue.enqueue(url, fetchOptions, "telemetry")
	}
}

async function queueForNetworkRetry(
	url: string,
	fetchOptions: RequestInit,
	allowQueueing: boolean,
	error: unknown,
	retryQueue: RetryQueue | null,
): Promise<void> {
	if (retryQueue && allowQueueing && error instanceof TypeError && error.message.includes("fetch failed")) {
		await retryQueue.enqueue(url, fetchOptions, "telemetry")
	}
}

export async function fetchTelemetry(
	path: string,
	options: RequestInit,
	opts: FetchTelemetryOptions,
	allowQueueing = true,
): Promise<Response | undefined> {
	if (!opts.authService.isAuthenticated()) {
		return undefined
	}

	const token = opts.authService.getSessionToken()

	if (!token) {
		console.error(`[TelemetryClient#fetch] Unauthorized: No session token available.`)
		return undefined
	}

	const url = `${getJabberwockApiUrl()}/api/${path}`
	const fetchOptions: RequestInit = {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	}

	try {
		const response = await fetch(url, fetchOptions)

		if (!response.ok) {
			logFetchError(options, path, response)
			await queueForRetry(url, fetchOptions, allowQueueing, response, opts.retryQueue)
		}

		return response
	} catch (error) {
		console.error(`[TelemetryClient#fetch] Network error for ${options.method} ${path}: ${error}`)

		await queueForNetworkRetry(url, fetchOptions, allowQueueing, error, opts.retryQueue)

		throw error
	}
}
