/**
 * PrefillStore — non-MST reactive store for prefill (prompt-processing) progress.
 *
 * Mirrors the StreamingStore pattern: a small, ephemeral, non-MST reactive
 * singleton. The backend polls the provider's prefill progress (llama.cpp
 * `/slots`) and broadcasts `prefillProgress` frames; this store holds the
 * latest percentage for the active task.
 *
 * `percent` is `null` when the provider does not expose a progress signal —
 * the UI then shows the indeterminate "Loading context…" label.
 */

export interface PrefillState {
	taskId: string | null
	percent: number | null
}

type Listener = (state: Readonly<PrefillState>) => void

export interface PrefillStore {
	/** Record the latest prefill progress for the active task. */
	set(taskId: string, percent: number | null): void
	/** Clear the store (e.g. at the start of a new stream attempt). */
	reset(): void
	/** Get a snapshot of the current state. */
	getSnapshot(): Readonly<PrefillState>
	/** Subscribe to state changes. Returns unsubscribe function. */
	subscribe(listener: Listener): () => void
}

/**
 * Create a prefill store.
 *
 * Factory-closure form (no class): state + listeners live in the closure.
 * The singleton below is the one shared instance.
 */
export function createPrefillStore(): PrefillStore {
	let state: PrefillState = { taskId: null, percent: null }
	const listeners = new Set<Listener>()

	function notify(): void {
		const snapshot = getSnapshot()
		for (const listener of listeners) {
			try {
				listener(snapshot)
			} catch (err) {
				console.error("[PrefillStore] listener error:", err)
			}
		}
	}

	function getSnapshot(): Readonly<PrefillState> {
		return { ...state }
	}

	return {
		set(taskId: string, percent: number | null): void {
			state = { taskId, percent }
			notify()
		},

		reset(): void {
			state = { taskId: null, percent: null }
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

/** Singleton prefill store instance. */
export const prefillStore = createPrefillStore()
