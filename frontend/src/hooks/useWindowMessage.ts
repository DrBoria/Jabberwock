import { useEffect, useRef } from "react"

/**
 * Subscribe to `window` "message" events. The handler is kept in a ref (the
 * "latest ref" pattern) so the listener is registered once — empty dependency
 * array, no re-subscription churn, no exhaustive-deps warnings — while still
 * always seeing the latest closure values.
 */
export function useWindowMessage(handler: (event: MessageEvent) => void): void {
	const handlerRef = useRef(handler)
	handlerRef.current = handler

	useEffect(() => {
		const onMessage = (event: MessageEvent) => handlerRef.current(event)
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [])
}
