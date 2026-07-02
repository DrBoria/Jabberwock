/**
 * Subscription function type for observable pattern.
 */
export type Observer<T> = (value: T) => void

/**
 * Unsubscribe function type.
 */
export type Unsubscribe = () => void

/**
 * Simple observable for state.
 *
 * This provides an alternative to the event emitter pattern
 * for those who prefer a more functional approach.
 *
 * Usage:
 * ```typescript
 * const stateObservable = new Observable<AgentStateInfo>()
 *
 * const unsubscribe = stateObservable.subscribe((state) => {
 *   console.log('New state:', state)
 * })
 *
 * // Later...
 * unsubscribe()
 * ```
 */
export class Observable<T> {
	private observers: Set<Observer<T>> = new Set()
	private currentValue: T | undefined

	/**
	 * Create an observable with an optional initial value.
	 */
	constructor(initialValue?: T) {
		this.currentValue = initialValue
	}

	/**
	 * Subscribe to value changes.
	 *
	 * @param observer - Function called when value changes
	 * @returns Unsubscribe function
	 */
	subscribe(observer: Observer<T>): Unsubscribe {
		this.observers.add(observer)

		// Immediately emit current value if we have one
		if (this.currentValue !== undefined) {
			observer(this.currentValue)
		}

		return () => {
			this.observers.delete(observer)
		}
	}

	/**
	 * Update the value and notify all subscribers.
	 */
	next(value: T): void {
		this.currentValue = value
		for (const observer of this.observers) {
			try {
				observer(value)
			} catch (error) {
				console.error("Error in observer:", error)
			}
		}
	}

	/**
	 * Get the current value without subscribing.
	 */
	getValue(): T | undefined {
		return this.currentValue
	}

	/**
	 * Check if there are any subscribers.
	 */
	hasSubscribers(): boolean {
		return this.observers.size > 0
	}

	/**
	 * Get the number of subscribers.
	 */
	getSubscriberCount(): number {
		return this.observers.size
	}

	/**
	 * Remove all subscribers.
	 */
	clear(): void {
		this.observers.clear()
	}
}
