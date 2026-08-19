import { EventEmitter } from "events"

import type { ClientEventMap } from "./types.js"

/**
 * Type-safe event emitter for client events.
 *
 * Usage:
 * ```typescript
 * const emitter = new TypedEventEmitter()
 *
 * // Type-safe subscription
 * emitter.on('stateChange', (event) => {
 *   console.log(event.currentState) // TypeScript knows this is AgentStateChangeEvent
 * })
 *
 * // Type-safe emission
 * emitter.emit('stateChange', { previousState, currentState, isSignificantChange })
 * ```
 */
export class TypedEventEmitter {
	private emitter = new EventEmitter()

	/**
	 * Subscribe to an event.
	 *
	 * @param event - The event name
	 * @param listener - The callback function
	 * @returns Function to unsubscribe
	 */
	on<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): () => void {
		this.emitter.on(event, listener)
		return () => this.emitter.off(event, listener)
	}

	/**
	 * Subscribe to an event, but only once.
	 *
	 * @param event - The event name
	 * @param listener - The callback function
	 */
	once<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): void {
		this.emitter.once(event, listener)
	}

	/**
	 * Unsubscribe from an event.
	 *
	 * @param event - The event name
	 * @param listener - The callback function to remove
	 */
	off<K extends keyof ClientEventMap>(event: K, listener: (payload: ClientEventMap[K]) => void): void {
		this.emitter.off(event, listener)
	}

	/**
	 * Emit an event.
	 *
	 * @param event - The event name
	 * @param payload - The event payload
	 */
	emit<K extends keyof ClientEventMap>(event: K, payload: ClientEventMap[K]): void {
		this.emitter.emit(event, payload)
	}

	/**
	 * Remove all listeners for an event, or all events.
	 *
	 * @param event - Optional event name. If not provided, removes all listeners.
	 */
	removeAllListeners<K extends keyof ClientEventMap>(event?: K): void {
		if (event) {
			this.emitter.removeAllListeners(event)
		} else {
			this.emitter.removeAllListeners()
		}
	}

	/**
	 * Get the number of listeners for an event.
	 */
	listenerCount<K extends keyof ClientEventMap>(event: K): number {
		return this.emitter.listenerCount(event)
	}
}
