import { StateStore } from "./state-store.js"

let defaultStore: StateStore | null = null

/**
 * Get the default singleton store instance.
 * Useful for simple applications that don't need multiple stores.
 */
export function getDefaultStore(): StateStore {
	if (!defaultStore) {
		defaultStore = new StateStore()
	}

	return defaultStore
}

/**
 * Reset the default store instance.
 * Useful for testing or when you need a fresh start.
 */
export function resetDefaultStore(): void {
	if (defaultStore) {
		defaultStore.reset()
	}

	defaultStore = null
}
