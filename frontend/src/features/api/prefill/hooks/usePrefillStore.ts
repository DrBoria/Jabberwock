/**
 * usePrefillStore — React hook wrapping PrefillStore.
 *
 * Subscribes to PrefillStore state changes and returns the latest snapshot.
 * Automatically unsubscribes on unmount.
 */

import { useState, useEffect } from "react"
import { prefillStore, type PrefillState } from "@src/features/api/prefill/store"

/**
 * Subscribe to PrefillStore and return current state.
 * React component re-renders when a new prefill percentage is reported.
 */
export function usePrefillStore(): Readonly<PrefillState> {
	const [state, setState] = useState<Readonly<PrefillState>>(() => prefillStore.getSnapshot())

	useEffect(() => {
		return prefillStore.subscribe(setState)
	}, [])

	return state
}
