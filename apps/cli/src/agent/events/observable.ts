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
 * const stateObservable = createObservable<AgentStateInfo>()
 *
 * const unsubscribe = stateObservable.subscribe((state) => {
 *   console.log('New state:', state)
 * })
 *
 * // Later...
 * unsubscribe()
 * ```
 */
export function createObservable<T>(initialValue?: T) {
	const observers = new Set<Observer<T>>()
	let currentValue = initialValue

	/**
	 * Subscribe to value changes.
	 *
	 * @param observer - Function called when value changes
	 * @returns Unsubscribe function
	 */
	function subscribe(observer: Observer<T>): Unsubscribe {
		observers.add(observer)

		// Immediately emit current value if we have one
		if (currentValue !== undefined) {
			observer(currentValue)
		}

		return () => {
			observers.delete(observer)
		}
	}

	/**
	 * Update the value and notify all subscribers.
	 */
	function next(value: T): void {
		currentValue = value
		for (const observer of observers) {
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
	function getValue(): T | undefined {
		return currentValue
	}

	/**
	 * Check if there are any subscribers.
	 */
	function hasSubscribers(): boolean {
		return observers.size > 0
	}

	/**
	 * Get the number of subscribers.
	 */
	function getSubscriberCount(): number {
		return observers.size
	}

	/**
	 * Remove all subscribers.
	 */
	function clear(): void {
		observers.clear()
	}

	return { subscribe, next, getValue, hasSubscribers, getSubscriberCount, clear }
}

/** Observable instance type */
export type Observable<T> = ReturnType<typeof createObservable<T>>
