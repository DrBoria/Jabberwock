import { Mutex } from "async-mutex"

import { t } from "@i18n"
import {
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
} from "@services/code-index/constants"
import { formatEmbeddingError, HttpError } from "@services/code-index/shared/validateContent"

interface RateLimitState {
	isRateLimited: boolean
	rateLimitResetTime: number
	consecutiveRateLimitErrors: number
	lastRateLimitError: number
	mutex: Mutex
}

export class EmbeddingRateLimiter {
	private static state: RateLimitState = {
		isRateLimited: false,
		rateLimitResetTime: 0,
		consecutiveRateLimitErrors: 0,
		lastRateLimitError: 0,
		mutex: new Mutex(),
	}

	async waitIfRateLimited(): Promise<void> {
		const release = await EmbeddingRateLimiter.state.mutex.acquire()
		try {
			const state = EmbeddingRateLimiter.state

			if (state.isRateLimited && state.rateLimitResetTime > Date.now()) {
				const waitTime = state.rateLimitResetTime - Date.now()
				release()
				await new Promise((resolve) => setTimeout(resolve, waitTime))
				return
			}

			if (state.isRateLimited && state.rateLimitResetTime <= Date.now()) {
				state.isRateLimited = false
				state.consecutiveRateLimitErrors = 0
			}
		} finally {
			try {
				release()
			} catch {
				// Already released
			}
		}
	}

	async updateOnRateLimit(_error: HttpError): Promise<void> {
		const release = await EmbeddingRateLimiter.state.mutex.acquire()
		try {
			const state = EmbeddingRateLimiter.state
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

	async getDelay(): Promise<number> {
		const release = await EmbeddingRateLimiter.state.mutex.acquire()
		try {
			const state = EmbeddingRateLimiter.state

			if (state.isRateLimited && state.rateLimitResetTime > Date.now()) {
				return state.rateLimitResetTime - Date.now()
			}

			return 0
		} finally {
			release()
		}
	}

	async handleRetryError(error: unknown, attempts: number): Promise<void> {
		const hasMoreAttempts = attempts < MAX_RETRIES - 1
		const httpError = error as HttpError

		if (httpError?.status === 429 && hasMoreAttempts) {
			await this.updateOnRateLimit(httpError)

			const baseDelay = INITIAL_DELAY_MS * Math.pow(2, attempts)
			const globalDelay = await this.getDelay()
			const delayMs = Math.max(baseDelay, globalDelay)

			console.warn(t("embeddings:rateLimitRetry", { delayMs, attempt: attempts + 1, maxRetries: MAX_RETRIES }))
			await new Promise((resolve) => setTimeout(resolve, delayMs))
			return
		}

		console.error(`[jabberwock] OpenAI Compatible embedder error (attempt ${attempts + 1}/${MAX_RETRIES}):`, error)

		throw formatEmbeddingError(error, MAX_RETRIES)
	}
}
