import type { ClientEventMap } from "./types.js"

/**
 * A listener that accepts a `never` payload is assignable-from "any" concrete
 * `ClientEventMap[K]` listener (contravariance: `never` is assignable to every
 * event payload type). This lets the internal registry store heterogeneous,
 * per-event listeners in one Map without leaking `any`.
 */
type StoredListener = (payload: never) => void

/**
 * Type-safe in-process event emitter for client events.
 *
 * Implemented directly over a `Map<eventName, Set<listener>>` (no node:events
 * dependency) so the CLI has no hidden `EventEmitter` state — state changes are
 * observed through the store, and this is a pure typed fan-out, not a source of
 * truth.
 *
 * Usage:
 * ```typescript
 * const emitter = createTypedEventEmitter()
 *
 * // Type-safe subscription
 * emitter.on('stateChange', (event) => {
 *   console.log(event.currentState) // TypeScript knows this is AgentStateChangeEvent
 * })
 *
 * // Type-safe emission
 * emitter.notify('stateChange', { previousState, currentState, isSignificantChange })
 * ```
 */
export function createTypedEventEmitter() {
	const listeners = new Map<keyof ClientEventMap, Set<StoredListener>>()

	/**
	 * Subscribe to an event.
	 *
	 * @param event - The event name
	 * @param listener - The callback function
	 * @returns Function to unsubscribe
	 */
	function on<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): () => void {
		addListener(event, listener)
		return () => off(event, listener)
	}

	/**
	 * Subscribe to an event, but only once.
	 *
	 * @param event - The event name
	 * @param listener - The callback function
	 */
	function once<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): void {
		const wrapped: (payload: ClientEventMap[K]) => void = (payload) => {
			off(event, wrapped)
			listener(payload)
		}
		addListener(event, wrapped)
	}

	/**
	 * Unsubscribe from "an" event.
	 *
	 * @param event - The event name
	 * @param listener - The callback function to remove
	 */
	function off<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): void {
		const set = listeners.get(event)
		if (!set) return
		set.delete(listener as StoredListener)
		if (set.size === 0) listeners.delete(event)
	}

	/**
	 * Fire an event to all of its listeners.
	 *
	 * @param event - The event name
	 * @param payload - The event payload
	 */
	function notify<K extends keyof ClientEventMap>(event: K, payload: ClientEventMap[K]): void {
		const set = listeners.get(event)
		if (!set) return
		// Snapshot so `once` listeners can unsubscribe during dispatch.
		for (const listener of [...set]) {
			;(listener as (payload: ClientEventMap[K]) => void)(payload)
		}
	}

	/**
	 * Remove all listeners for an event, or all events.
	 *
	 * @param event - Optional event name. If not provided, removes all listeners.
	 */
	function removeAllListeners<K extends keyof ClientEventMap>(event?: K): void {
		if (event) {
			listeners.delete(event)
		} else {
			listeners.clear()
		}
	}

	/**
	 * Get the number of listeners for an event.
	 */
	function listenerCount<K extends keyof ClientEventMap>(event: K): number {
		return listeners.get(event)?.size ?? 0
	}

	function addListener<K extends keyof ClientEventMap>(
		event: K,
		listener: (payload: ClientEventMap[K]) => void,
	): void {
		let set = listeners.get(event)
		if (!set) {
			set = new Set<StoredListener>()
			listeners.set(event, set)
		}
		set.add(listener as StoredListener)
	}

	return { on, once, off, notify, removeAllListeners, listenerCount }
}

/** TypedEventEmitter instance type */
export type TypedEventEmitter = ReturnType<typeof createTypedEventEmitter>
