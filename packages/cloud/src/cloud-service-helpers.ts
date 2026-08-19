import type { CloudServiceEvents, AuthService } from "@jabberwock/types"
import type { RetryQueue } from "./retry-queue/index.ts"

type AuthStateChangedPayload = CloudServiceEvents["auth-state-changed"][0]

export function handleAuthStateChangeForRetryQueue(
	data: AuthStateChangedPayload,
	retryQueue: RetryQueue | null,
	getUserInfo: () => { id?: string } | undefined,
	log: (...args: unknown[]) => void,
): void {
	if (!retryQueue) {
		return
	}

	const newState = data.state
	const userInfo = getUserInfo()
	const newUserId = userInfo?.id

	log(`[CloudService] Auth state changed to: ${newState}, user: ${newUserId}`)

	switch (newState) {
		case "active-session": {
			const wasCleared = retryQueue.clearIfUserChanged(newUserId)

			if (!wasCleared) {
				retryQueue.resume()
				log("[CloudService] Resuming retry queue for active session")
			} else {
				retryQueue.resume()
				log("[CloudService] Retry queue cleared for new user, resuming processing")
			}
			break
		}

		case "logged-out":
			retryQueue.clearIfUserChanged(undefined)
			retryQueue.pause()
			log("[CloudService] Pausing and clearing retry queue for logged-out state")
			break

		case "initializing":
		case "attempting-session":
			retryQueue.pause()
			log(`[CloudService] Pausing retry queue during ${newState}`)
			break

		case "inactive-session":
			retryQueue.pause()
			log("[CloudService] Pausing retry queue for inactive session")
			break

		default:
			retryQueue.pause()
			log(`[CloudService] Pausing retry queue for unknown state: ${newState}`)
	}
}

export function createAuthHeaderProvider(
	getAuthService: () => AuthService | null,
): () => Record<string, string> | undefined {
	return () => {
		const sessionToken = getAuthService()?.getSessionToken()

		if (sessionToken) {
			return { Authorization: `Bearer ${sessionToken}` }
		}

		return undefined
	}
}
