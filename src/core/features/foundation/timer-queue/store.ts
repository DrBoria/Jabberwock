import { types, Instance } from "mobx-state-tree"

/**
 * Priority levels for timer queue items.
 */
import type { ClineProvider } from "../../../webview/ClineProvider"
export type Priority = "high" | "medium" | "low"

/**
 * Lifecycle state for a queued event.
 */
export type LifecycleState = "pending" | "running" | "completed" | "cancelled"

/**
 * A single timer entry in the queue.
 */
export const TimerEntry = types
	.model("TimerEntry", {
		id: types.identifier,
		label: types.string,
		priority: types.optional(types.enumeration<Priority>(["high", "medium", "low"]), "medium"),
		timeoutMs: types.number,
		lifecycle: types.optional(
			types.enumeration<LifecycleState>(["pending", "running", "completed", "cancelled"]),
			"pending",
		),
		createdAt: types.optional(types.number, () => Date.now()),
		startedAt: types.maybe(types.number),
		completedAt: types.maybe(types.number),
		retryCount: types.optional(types.number, 0),
		maxRetries: types.optional(types.number, 0),
	})
	.actions((self) => ({
		markRunning() {
			self.lifecycle = "running"
			self.startedAt = Date.now()
		},
		markCompleted() {
			self.lifecycle = "completed"
			self.completedAt = Date.now()
		},
		markCancelled() {
			self.lifecycle = "cancelled"
			self.completedAt = Date.now()
		},
		incrementRetry() {
			self.retryCount += 1
		},
	}))

/**
 * Timer queue store — manages a priority queue of timed events with
 * lifecycle tracking, cancellation, debouncing, and retry support.
 */
export const TimerQueueStore = types
	.model("TimerQueueStore", {
		entries: types.array(TimerEntry),
		defaultTimeoutMs: types.optional(types.number, 5000),
	})
	.views((self) => ({
		/**
		 * Returns entries sorted by priority (high first), then by creation time.
		 */
		get sortedEntries() {
			const priorityWeight: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
			return [...self.entries].sort((a, b) => {
				const pa = priorityWeight[a.priority]
				const pb = priorityWeight[b.priority]
				if (pa !== pb) return pa - pb
				return a.createdAt - b.createdAt
			})
		},

		/**
		 * Returns only pending entries.
		 */
		get pendingEntries() {
			return self.entries.filter((e) => e.lifecycle === "pending")
		},

		/**
		 * Returns only running entries.
		 */
		get runningEntries() {
			return self.entries.filter((e) => e.lifecycle === "running")
		},

		/**
		 * Returns completed entries.
		 */
		get completedEntries() {
			return self.entries.filter((e) => e.lifecycle === "completed")
		},

		/**
		 * Returns cancelled entries.
		 */
		get cancelledEntries() {
			return self.entries.filter((e) => e.lifecycle === "cancelled")
		},

		/**
		 * Find an entry by its id.
		 */
		getEntry(id: string) {
			return self.entries.find((e) => e.id === id) ?? null
		},
	}))
	.actions((self) => ({
		/**
		 * Schedule a new timer entry.
		 * Returns the entry id.
		 */
		schedule(opts: {
			id: string
			label: string
			priority?: Priority
			timeoutMs?: number
			maxRetries?: number
		}): string {
			const entry = TimerEntry.create({
				id: opts.id,
				label: opts.label,
				priority: opts.priority ?? "medium",
				timeoutMs: opts.timeoutMs ?? self.defaultTimeoutMs,
				maxRetries: opts.maxRetries ?? 0,
			})
			self.entries.push(entry)
			return entry.id
		},

		/**
		 * Cancel a scheduled entry by id.
		 */
		cancel(id: string): boolean {
			const entry = self.entries.find((e) => e.id === id)
			if (entry && entry.lifecycle === "pending") {
				entry.markCancelled()
				return true
			}
			return false
		},

		/**
		 * Mark an entry as running.
		 */
		markRunning(id: string): boolean {
			const entry = self.entries.find((e) => e.id === id)
			if (entry) {
				entry.markRunning()
				return true
			}
			return false
		},

		/**
		 * Mark an entry as completed.
		 */
		markCompleted(id: string): boolean {
			const entry = self.entries.find((e) => e.id === id)
			if (entry) {
				entry.markCompleted()
				return true
			}
			return false
		},

		/**
		 * Create an abort promise that resolves when the entry completes or is cancelled.
		 */
		createAbortPromise(id: string): Promise<void> {
			return new Promise((resolve) => {
				const check = () => {
					const entry = self.entries.find((e) => e.id === id)
					if (!entry || entry.lifecycle === "completed" || entry.lifecycle === "cancelled") {
						resolve()
					} else {
						setTimeout(check, 50)
					}
				}
				check()
			})
		},

		/**
		 * Create a timeout promise that rejects when the entry completes (timeout fires).
		 * Unlike createAbortPromise, this only resolves on completion, not cancellation.
		 * Use cancel() to prevent the timeout from firing.
		 */
		createTimeoutPromise(id: string, errorMessage?: string): Promise<never> {
			return new Promise<never>((_, reject) => {
				const check = () => {
					const entry = self.entries.find((e) => e.id === id)
					if (!entry) {
						reject(new Error(errorMessage ?? "Timer entry not found"))
					} else if (entry.lifecycle === "completed") {
						reject(new Error(errorMessage ?? "Operation timed out"))
					} else if (entry.lifecycle !== "cancelled") {
						setTimeout(check, 50)
					}
					// If cancelled, the promise never resolves/rejects (caller handles cancellation)
				}
				check()
			})
		},

		/**
		 * Debounce a write operation: cancel any existing entry with the same label,
		 * then schedule a new one.
		 */
		debounceWrite(opts: { id: string; label: string; timeoutMs?: number }): string {
			// Cancel any existing entry with the same label
			const existing = self.entries.filter((e) => e.label === opts.label && e.lifecycle === "pending")
			for (const e of existing) {
				e.markCancelled()
			}

			return this.schedule({
				id: opts.id,
				label: opts.label,
				priority: "high",
				timeoutMs: opts.timeoutMs ?? self.defaultTimeoutMs,
			})
		},

		/**
		 * Schedule a retry for a failed entry.
		 * Returns the new entry id, or null if max retries exceeded.
		 */
		scheduleRetry(id: string): string | null {
			const entry = self.entries.find((e) => e.id === id)
			if (!entry) return null
			if (entry.retryCount >= entry.maxRetries) return null

			const newId = `${id}-retry-${entry.retryCount + 1}`
			const newEntry = TimerEntry.create({
				id: newId,
				label: entry.label,
				priority: entry.priority,
				timeoutMs: entry.timeoutMs,
				maxRetries: entry.maxRetries,
				retryCount: entry.retryCount + 1,
			})
			self.entries.push(newEntry)
			return newId
		},

		/**
		 * Remove completed and cancelled entries (garbage collection).
		 */
		cleanup() {
			self.entries.replace(self.entries.filter((e) => e.lifecycle === "pending" || e.lifecycle === "running"))
		},
	}))

export function createTimerQueueStore(defaultTimeoutMs = 5000) {
	return TimerQueueStore.create({ defaultTimeoutMs })
}

// ---------------------------------------------------------------------------
// Pending Edit Operations (extracted from ClineProvider)
// ---------------------------------------------------------------------------

export const PENDING_OPERATION_TIMEOUT_MS = 30000 // 30 seconds

export interface PendingEditOperation {
	messageTs: number
	editedContent: string
	images?: string[]
	messageIndex: number
	apiConversationHistoryIndex: number
	timeoutId: NodeJS.Timeout
	createdAt: number
}

/**
 * Sets a pending edit operation with automatic timeout cleanup
 */
export function setPendingEditOperation(
	provider: ClineProvider,
	operationId: string,
	editData: {
		messageTs: number
		editedContent: string
		images?: string[]
		messageIndex: number
		apiConversationHistoryIndex: number
	},
): void {
	const p = provider as any

	// Clear any existing operation with the same ID
	clearPendingEditOperation(provider, operationId)

	// Create timeout for automatic cleanup
	const timeoutId = setTimeout(() => {
		clearPendingEditOperation(provider, operationId)
		p.log(`[setPendingEditOperation] Automatically cleared stale pending operation: ${operationId}`)
	}, PENDING_OPERATION_TIMEOUT_MS)

	// Store the operation
	p.pendingOperations.set(operationId, {
		...editData,
		timeoutId,
		createdAt: Date.now(),
	})

	p.log(`[setPendingEditOperation] Set pending operation: ${operationId}`)
}

/**
 * Gets a pending edit operation by ID
 */
export function getPendingEditOperation(
	provider: ClineProvider,
	operationId: string,
): PendingEditOperation | undefined {
	const p = provider as any
	return p.pendingOperations.get(operationId)
}

/**
 * Clears a specific pending edit operation
 */
export function clearPendingEditOperation(provider: ClineProvider, operationId: string): boolean {
	const p = provider as any
	const operation = p.pendingOperations.get(operationId)
	if (operation) {
		clearTimeout(operation.timeoutId)
		p.pendingOperations.delete(operationId)
		p.log(`[clearPendingEditOperation] Cleared pending operation: ${operationId}`)
		return true
	}
	return false
}

/**
 * Clears all pending edit operations
 */
export function clearAllPendingEditOperations(provider: ClineProvider): void {
	const p = provider as any
	for (const [operationId, operation] of p.pendingOperations) {
		clearTimeout(operation.timeoutId)
	}
	p.pendingOperations.clear()
	p.log(`[clearAllPendingEditOperations] Cleared all pending operations`)
}

export type ITimerQueueStore = Instance<typeof TimerQueueStore>
export type ITimerEntry = Instance<typeof TimerEntry>
