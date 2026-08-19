import { EventEmitter } from "events"
import type { ExtensionContext } from "vscode"
import type { QueuedRequest, QueueStats, RetryQueueConfig, RetryQueueEvents } from "./types.ts"
import {
	computeQueueStats,
	loadPersistedQueue as loadPersistedQueueHelper,
	persistQueue as persistQueueHelper,
	clearIfUserChanged as clearIfUserChangedHelper,
} from "./helpers.ts"
import { RetryQueueProcessor } from "./processor.ts"

type AuthHeaderProvider = () => Record<string, string> | undefined

export class RetryQueue extends EventEmitter<RetryQueueEvents> {
	private queue: Map<string, QueuedRequest> = new Map()
	private context: ExtensionContext
	private config: RetryQueueConfig
	private log: (...args: unknown[]) => void
	private isProcessing = false
	private retryTimer?: NodeJS.Timeout
	private readonly STORAGE_KEY = "jabberwock.retryQueue"
	private authHeaderProvider?: AuthHeaderProvider
	private isPaused = false
	private currentUserId?: string
	private hasHadUser = false
	private processor: RetryQueueProcessor

	constructor(
		context: ExtensionContext,
		config?: Partial<RetryQueueConfig>,
		log?: (...args: unknown[]) => void,
		authHeaderProvider?: AuthHeaderProvider,
	) {
		super()
		this.context = context
		this.log = log || console.log
		this.authHeaderProvider = authHeaderProvider

		this.config = {
			maxRetries: 0,
			retryDelay: 60000,
			maxQueueSize: 100,
			persistQueue: true,
			networkCheckInterval: 60000,
			requestTimeout: 30000,
			...config,
		}

		let queuePausedUntil: number | undefined

		this.processor = new RetryQueueProcessor({
			queue: this.queue,
			config: this.config,
			log: this.log,
			emit: (event, ...args: unknown[]) =>
				(this.emit as (event: string, ...args: unknown[]) => boolean)(event, ...args),
			authHeaderProvider: this.authHeaderProvider,
			isProcessing: () => this.isProcessing,
			isPaused: () => this.isPaused,
			queuePausedUntil: () => queuePausedUntil,
			setQueuePausedUntil: (value) => {
				queuePausedUntil = value
			},
		})

		this.loadPersistedQueue()
		this.startRetryTimer()
	}

	private loadPersistedQueue(): void {
		loadPersistedQueueHelper(this.context, this.STORAGE_KEY, this.queue, this.log, this.config.persistQueue)
	}

	private async persistQueue(): Promise<void> {
		await persistQueueHelper(this.context, this.STORAGE_KEY, this.queue, this.log, this.config.persistQueue)
	}

	public async enqueue(
		url: string,
		options: RequestInit,
		type: QueuedRequest["type"] = "other",
		operation?: string,
	): Promise<void> {
		if (this.queue.size >= this.config.maxQueueSize) {
			const oldestId = Array.from(this.queue.keys())[0]
			if (oldestId) {
				this.queue.delete(oldestId)
			}
		}

		const request: QueuedRequest = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			url,
			options,
			timestamp: Date.now(),
			retryCount: 0,
			type,
			operation,
		}

		this.queue.set(request.id, request)
		await this.persistQueue()

		this.emit("request-queued", request)
		this.log(`[RetryQueue] Queued request: ${url}`)
	}

	public async retryAll(): Promise<void> {
		if (!this.processor.canRetry()) {
			return
		}

		const requests = Array.from(this.queue.values())
		if (requests.length === 0) {
			return
		}

		this.isProcessing = true

		try {
			requests.sort((a, b) => a.timestamp - b.timestamp)

			for (const request of requests) {
				const shouldStop = await this.processor.processRetryRequest(request)

				if (shouldStop) {
					break
				}
			}

			await this.persistQueue()
		} finally {
			this.isProcessing = false
		}
	}

	public getStats(): QueueStats {
		return computeQueueStats(this.queue)
	}

	public clear(): void {
		this.queue.clear()
		this.persistQueue().catch((error) => {
			this.log("[RetryQueue] Failed to persist after clear:", error)
		})
		this.emit("queue-cleared")
	}

	public pause(): void {
		this.isPaused = true
		this.log("[RetryQueue] Queue paused")
	}

	public resume(): void {
		this.isPaused = false
		this.log("[RetryQueue] Queue resumed")
	}

	public isPausedState(): boolean {
		return this.isPaused
	}

	public setCurrentUserId(userId: string | undefined): void {
		this.currentUserId = userId
	}

	public getCurrentUserId(): string | undefined {
		return this.currentUserId
	}

	public clearIfUserChanged(newUserId: string | undefined): boolean {
		const result = clearIfUserChangedHelper(
			newUserId,
			this.currentUserId,
			this.hasHadUser,
			() => this.clear(),
			this.log,
		)
		this.currentUserId = result.currentUserId
		this.hasHadUser = result.hasHadUser
		return result.changed
	}

	private startRetryTimer(): void {
		if (this.retryTimer) {
			clearInterval(this.retryTimer)
		}

		this.retryTimer = setInterval(() => {
			this.retryAll().catch((error) => {
				this.log("[RetryQueue] Error during retry cycle:", error)
			})
		}, this.config.networkCheckInterval)
	}

	public dispose(): void {
		if (this.retryTimer) {
			clearInterval(this.retryTimer)
		}
		this.removeAllListeners()
	}
}
