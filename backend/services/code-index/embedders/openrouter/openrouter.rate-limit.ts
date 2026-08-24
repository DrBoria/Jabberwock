import { Mutex } from "async-mutex"

export interface GlobalRateLimitState {
	isRateLimited: boolean
	rateLimitResetTime: number
	consecutiveRateLimitErrors: number
	lastRateLimitError: number
	mutex: Mutex
}

export function createGlobalRateLimitState(): GlobalRateLimitState {
	return {
		isRateLimited: false,
		rateLimitResetTime: 0,
		consecutiveRateLimitErrors: 0,
		lastRateLimitError: 0,
		mutex: new Mutex(),
	}
}

export async function waitForGlobalRateLimit(state: GlobalRateLimitState): Promise<void> {
	const release = await state.mutex.acquire()
	let mutexReleased = false

	try {
		if (state.isRateLimited && state.rateLimitResetTime > Date.now()) {
			const waitTime = state.rateLimitResetTime - Date.now()
			release()
			mutexReleased = true
			await new Promise((resolve) => setTimeout(resolve, waitTime))
			return
		}

		if (state.isRateLimited && state.rateLimitResetTime <= Date.now()) {
			state.isRateLimited = false
			state.consecutiveRateLimitErrors = 0
		}
	} finally {
		if (!mutexReleased) {
			release()
		}
	}
}

export async function updateGlobalRateLimitState(state: GlobalRateLimitState): Promise<void> {
	const release = await state.mutex.acquire()
	try {
		const now = Date.now()

		if (now - state.lastRateLimitError < 60000) {
			state.consecutiveRateLimitErrors++
		} else {
			state.consecutiveRateLimitErrors = 1
		}

		state.lastRateLimitError = now

		const baseDelay = 5000
		const maxDelay = 300000
		const exponentialDelay = Math.min(baseDelay * Math.pow(2, state.consecutiveRateLimitErrors - 1), maxDelay)

		state.isRateLimited = true
		state.rateLimitResetTime = now + exponentialDelay
	} finally {
		release()
	}
}

export async function getGlobalRateLimitDelay(state: GlobalRateLimitState): Promise<number> {
	const release = await state.mutex.acquire()
	try {
		if (state.isRateLimited && state.rateLimitResetTime > Date.now()) {
			return state.rateLimitResetTime - Date.now()
		}

		return 0
	} finally {
		release()
	}
}
