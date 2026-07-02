import type { QueuedRequest, QueueStats } from "./types.ts"

export async function retryRequest(
	request: QueuedRequest,
	log: (...args: unknown[]) => void,
	authHeaderProvider?: () => Record<string, string> | undefined,
	requestTimeout = 30000,
): Promise<Response> {
	log(`[RetryQueue] Retrying request: ${request.url}`)

	let headers = { ...request.options.headers }
	if (authHeaderProvider) {
		const freshAuthHeaders = authHeaderProvider()
		if (freshAuthHeaders) {
			headers = {
				...headers,
				...freshAuthHeaders,
			}
		}
	}

	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

	try {
		const response = await fetch(request.url, {
			...request.options,
			signal: controller.signal,
			headers: {
				...headers,
				"X-Retry-Queue": "true",
			},
		})

		clearTimeout(timeoutId)

		// Check for error status codes that should trigger retry
		if (!response.ok) {
			// Handle different status codes appropriately
			if (response.status >= 500) {
				// Server errors (5xx) should be retried
				throw new Error(`Server error: ${response.status} ${response.statusText}`)
			} else if (response.status === 429) {
				// Rate limiting - return response to let caller handle Retry-After
				return response
			} else if (response.status >= 400 && response.status < 500) {
				// Client errors (4xx including 401/403) should NOT be retried
				// These errors indicate problems with the request itself that won't be fixed by retrying
				log(`[RetryQueue] Non-retryable client error ${response.status}, removing from queue`)
				return response
			}
		}

		return response
	} catch (error) {
		clearTimeout(timeoutId)
		throw error
	}
}

export function computeQueueStats(queue: Map<string, QueuedRequest>): QueueStats {
	const requests = Array.from(queue.values())
	const byType: Record<string, number> = {}
	let totalRetries = 0
	let failedRetries = 0

	requests.forEach((request) => {
		byType[request.type] = (byType[request.type] || 0) + 1
		totalRetries += request.retryCount
		if (request.lastError) {
			failedRetries++
		}
	})

	const timestamps = requests.map((r) => r.timestamp)
	const oldestRequest = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined
	const newestRequest = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined

	return {
		totalQueued: requests.length,
		byType,
		oldestRequest,
		newestRequest,
		totalRetries,
		failedRetries,
	}
}

export async function loadPersistedQueue(
	context: { workspaceState: { get: <T>(key: string) => T | undefined } },
	storageKey: string,
	queue: Map<string, QueuedRequest>,
	log: (...args: unknown[]) => void,
	persistQueue: boolean,
): Promise<void> {
	if (!persistQueue) return

	try {
		const stored = context.workspaceState.get<QueuedRequest[]>(storageKey)
		if (stored && Array.isArray(stored)) {
			stored.forEach((request) => {
				queue.set(request.id, request)
			})
			log(`[RetryQueue] Loaded ${stored.length} persisted requests from workspace storage`)
		}
	} catch (error) {
		log("[RetryQueue] Failed to load persisted queue:", error)
	}
}

export async function persistQueue(
	context: { workspaceState: { update: (key: string, value: unknown) => Thenable<void> } },
	storageKey: string,
	queue: Map<string, QueuedRequest>,
	log: (...args: unknown[]) => void,
	persistQueue: boolean,
): Promise<void> {
	if (!persistQueue) return

	try {
		const requests = Array.from(queue.values())
		await context.workspaceState.update(storageKey, requests)
	} catch (error) {
		log("[RetryQueue] Failed to persist queue:", error)
	}
}

export function clearIfUserChanged(
	newUserId: string | undefined,
	currentUserId: string | undefined,
	hasHadUser: boolean,
	clear: () => void,
	log: (...args: unknown[]) => void,
): { hasHadUser: boolean; currentUserId: string | undefined; changed: boolean } {
	// First time ever setting a user (initial login)
	if (!hasHadUser && newUserId !== undefined) {
		return { hasHadUser: true, currentUserId: newUserId, changed: false }
	}

	// If user IDs are different (including logout case where newUserId is undefined)
	if (currentUserId !== newUserId) {
		log(`[RetryQueue] User changed from ${currentUserId} to ${newUserId}, clearing queue`)
		clear()
		if (newUserId !== undefined) {
			return { hasHadUser: true, currentUserId: newUserId, changed: true }
		}
		return { hasHadUser, currentUserId: newUserId, changed: true }
	}

	return { hasHadUser, currentUserId, changed: false }
}
