import type { HistoryEntry, StoreChange } from "../../types.js"

/**
 * A fixed-capacity ring buffer of point-in-time snapshots.
 *
 * Used by the plain-object adapters (redux, zustand, apollo) to provide the
 * "previous versions" / undo-redo capability. Each {@link record} call pushes a
 * new snapshot; once the buffer is full the oldest entry is dropped.
 */
export class SnapshotHistory {
	private entries: HistoryEntry[] = []
	private nextId = 0
	private readonly capacity: number

	constructor(capacity = 50) {
		this.capacity = Math.max(1, capacity)
	}

	/** Push a new snapshot (optionally labeled with the action that produced it). */
	record(snapshot: Record<string, unknown>, label?: string): HistoryEntry {
		const entry: HistoryEntry = {
			id: this.nextId++,
			timestamp: Date.now(),
			label,
			snapshot,
		}
		this.entries.push(entry)
		if (this.entries.length > this.capacity) {
			this.entries.shift()
		}
		return entry
	}

	/** All recorded snapshots, oldest first. */
	list(): HistoryEntry[] {
		return [...this.entries]
	}

	/** The most recent snapshot, or undefined if none recorded. */
	latest(): HistoryEntry | undefined {
		return this.entries[this.entries.length - 1]
	}

	/** The snapshot immediately before the latest (the "previous" state). */
	previous(): HistoryEntry | undefined {
		return this.entries.length >= 2 ? this.entries[this.entries.length - 2] : undefined
	}

	get size(): number {
		return this.entries.length
	}

	clear(): void {
		this.entries = []
		this.nextId = 0
	}
}

/**
 * A fixed-capacity ring buffer of change events (the action log).
 * Adapters with no native change stream (redux, zustand) use this to expose
 * the change history once they hook into the store's mutation points.
 */
export class ChangeLog {
	private entries: StoreChange[] = []
	private readonly capacity: number

	constructor(capacity = 500) {
		this.capacity = Math.max(1, capacity)
	}

	append(change: StoreChange): void {
		this.entries.push(change)
		if (this.entries.length > this.capacity) {
			this.entries.shift()
		}
	}

	list(): StoreChange[] {
		return [...this.entries]
	}

	/** Newest-first view, optionally limited. */
	tail(limit = 50): StoreChange[] {
		return this.entries.slice(-limit).reverse()
	}

	get size(): number {
		return this.entries.length
	}

	clear(): void {
		this.entries = []
	}
}
