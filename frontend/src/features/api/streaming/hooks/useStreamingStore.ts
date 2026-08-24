/**
 * useStreamingStore — React hook wrapping StreamingStore.
 *
 * Subscribes to StreamingStore state changes and returns the latest snapshot.
 * Automatically unsubscribes on unmount.
 */

import { useState, useEffect } from "react"
import { streamingStore, type StreamingState } from "../store"

/**
 * Subscribe to StreamingStore and return current state.
 * React component re-renders on each chunk during active streaming.
 */
export function useStreamingStore(): Readonly<StreamingState> {
	const [state, setState] = useState<Readonly<StreamingState>>(() => streamingStore.getSnapshot())

	useEffect(() => {
		return streamingStore.subscribe(setState)
	}, [])

	return state
}
