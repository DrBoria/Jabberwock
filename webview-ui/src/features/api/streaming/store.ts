/**
 * StreamingStore — non-MST reactive store for streaming text chunks.
 *
 * NON-MST REACTIVE STORE — ephemeral, exists only during streaming.
 * Not part of MST because:
 *   1. Receives 1000+ updates per second — MST snapshots would be expensive
 *   2. State is ephemeral — no need for persistence or undo
 *   3. Only one stream active at a time
 *
 * This is the SINGLE documented exception to the "no state outside MST" rule.
 * See plans/architectural-restructure-v2.md §Streaming Architecture.
 */

export interface StreamingState {
	taskId: string | null
	text: string
	isActive: boolean
	error: string | null
}

type Listener = (state: Readonly<StreamingState>) => void

export class StreamingStore {
	private state: StreamingState = {
		taskId: null,
		text: "",
		isActive: false,
		error: null,
	}

	private listeners = new Set<Listener>()

	/**
	 * Append the incoming delta to the current stream buffer.
	 * The backend now sends per-chunk deltas (not full accumulated text)
	 * to minimise postMessage payload size.
	 */
	appendChunk(chunk: string): void {
		this.state.text += chunk
		this.notify()
	}

	/** Start a new streaming session for the given task ID. */
	start(taskId: string): void {
		this.state = { taskId, text: "", isActive: true, error: null }
		this.notify()
	}

	/** End the current streaming session with optional error. */
	end(finalText: string, error?: string): void {
		this.state.text = finalText
		this.state.isActive = false
		this.state.error = error ?? null
		this.notify()
	}

	/** Reset the store to initial state. */
	reset(): void {
		this.state = { taskId: null, text: "", isActive: false, error: null }
		this.notify()
	}

	/** Get a snapshot of the current state. */
	getSnapshot(): Readonly<StreamingState> {
		return { ...this.state }
	}

	/** Subscribe to state changes. Returns unsubscribe function. */
	subscribe(listener: Listener): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	private notify(): void {
		const snapshot = this.getSnapshot()
		for (const listener of this.listeners) {
			try {
				listener(snapshot)
			} catch (err) {
				console.error("[StreamingStore] listener error:", err)
			}
		}
	}
}

/** Singleton streaming store instance. */
export const streamingStore = new StreamingStore()
