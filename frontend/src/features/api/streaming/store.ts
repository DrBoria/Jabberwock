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

export interface StreamingStore {
	/**
	 * Append the incoming delta to the current stream buffer.
	 * The backend now sends per-chunk deltas (not full accumulated text)
	 * to minimise postMessage payload size.
	 */
	appendChunk(chunk: string): void
	/** Start a new streaming session for the given task ID. */
	start(taskId: string): void
	/** End the current streaming session with optional error. */
	end(finalText: string, error?: string): void
	/** Reset the store to initial state. */
	reset(): void
	/** Get a snapshot of the current state. */
	getSnapshot(): Readonly<StreamingState>
	/** Subscribe to state changes. Returns unsubscribe function. */
	subscribe(listener: Listener): () => void
}

/**
 * Create a streaming store.
 *
 * Factory-closure form (no class): the state + listeners live in the closure,
 * not module state. The singleton below is the one shared instance.
 */
export function createStreamingStore(): StreamingStore {
	let state: StreamingState = {
		taskId: null,
		text: "",
		isActive: false,
		error: null,
	}
	const listeners = new Set<Listener>()

	function notify(): void {
		const snapshot = getSnapshot()
		for (const listener of listeners) {
			try {
				listener(snapshot)
			} catch (err) {
				console.error("[StreamingStore] listener error:", err)
			}
		}
	}

	function getSnapshot(): Readonly<StreamingState> {
		return { ...state }
	}

	return {
		appendChunk(chunk: string): void {
			state.text += chunk
			notify()
		},

		start(taskId: string): void {
			state = { taskId, text: "", isActive: true, error: null }
			notify()
		},

		end(finalText: string, error?: string): void {
			state.text = finalText
			state.isActive = false
			state.error = error ?? null
			notify()
		},

		reset(): void {
			state = { taskId: null, text: "", isActive: false, error: null }
			notify()
		},

		getSnapshot,

		subscribe(listener: Listener): () => void {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
	}
}

/** Singleton streaming store instance. */
export const streamingStore = createStreamingStore()
