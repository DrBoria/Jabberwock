import type { QueuedRequest, RetryQueueConfig } from "./types.ts"
import { retryRequest as retryRequestHelper } from "./helpers.ts"

export interface RetryQueueProcessorDeps {
	queue: Map<string, QueuedRequest>
	config: RetryQueueConfig
	log: (...args: unknown[]) => void
	emit: (event: string, ...args: unknown[]) => void
	authHeaderProvider?: () => Record<string, string> | undefined
	isProcessing: () => boolean
	isPaused: () => boolean
	queuePausedUntil: () => number | undefined
	setQueuePausedUntil: (value: number | undefined) => void
}

export class RetryQueueProcessor {
	private deps: RetryQueueProcessorDeps

	constructor(deps: RetryQueueProcessorDeps) {
		this.deps = deps
	}

	canRetry(): boolean {
		if (this.deps.isProcessing()) {
			this.deps.log("[RetryQueue] Already processing, skipping retry cycle")
			return false
		}

		if (this.deps.isPaused()) {
			this.deps.log("[RetryQueue] Queue is manually paused")
			return false
		}

		const pausedUntil = this.deps.queuePausedUntil()
		if (pausedUntil && Date.now() < pausedUntil) {
			this.deps.log(`[RetryQueue] Queue is paused until ${new Date(pausedUntil).toISOString()}`)
			return false
		}

		return true
	}

	async processRetryRequest(request: QueuedRequest): Promise<boolean> {
		try {
			const response = await this.retryRequest(request)

			if (response && response.status === 429) {
				return this.handleRateLimit(response, request)
			}

			this.deps.queue.delete(request.id)
			this.deps.emit("request-retry-success", request)
			return false
		} catch (error) {
			return this.handleRetryError(request, error)
		}
	}

	private handleRateLimit(response: Response, request: QueuedRequest): boolean {
		const retryAfter = response.headers.get("Retry-After")
		if (retryAfter) {
			const delayMs = RetryQueueProcessor.parseRetryAfter(retryAfter)
			this.deps.setQueuePausedUntil(Date.now() + delayMs)
			this.deps.log(`[RetryQueue] Rate limited, pausing entire queue for ${delayMs}ms`)
			this.deps.queue.set(request.id, request)
			return true
		}

		this.deps.queue.delete(request.id)
		this.deps.emit("request-retry-success", request)
		return false
	}

	static parseRetryAfter(retryAfter: string): number {
		const retryAfterSeconds = parseInt(retryAfter, 10)
		if (!isNaN(retryAfterSeconds)) {
			return retryAfterSeconds * 1000
		}

		const retryDate = new Date(retryAfter)
		if (!isNaN(retryDate.getTime())) {
			return retryDate.getTime() - Date.now()
		}

		return 60000
	}

	private handleRetryError(request: QueuedRequest, error: unknown): boolean {
		request.retryCount++
		request.lastError = error instanceof Error ? error.message : String(error)

		if (this.deps.config.maxRetries > 0 && request.retryCount >= this.deps.config.maxRetries) {
			this.deps.log(
				`[RetryQueue] Max retries (${this.deps.config.maxRetries}) reached for request: ${request.url}`,
			)
			this.deps.queue.delete(request.id)
			this.deps.emit("request-max-retries-exceeded", request, error as Error)
		} else {
			this.deps.queue.set(request.id, request)
			this.deps.emit("request-retry-failed", request, error as Error)
		}

		delay(100)
		return false
	}

	private async retryRequest(request: QueuedRequest): Promise<Response> {
		return await retryRequestHelper(
			request,
			this.deps.log,
			this.deps.authHeaderProvider,
			this.deps.config.requestTimeout,
		)
	}
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
