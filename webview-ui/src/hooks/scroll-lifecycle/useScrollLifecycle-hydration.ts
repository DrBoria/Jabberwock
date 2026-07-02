import React, { useCallback, useEffect, useRef } from "react"

import type { ScrollPhase } from "./useScrollLifecycle-helpers"

const HYDRATION_WINDOW_MS = 600
const HYDRATION_RETRY_WINDOW_MS = 160

export function useScrollLifecycleHydration(
	taskTs: number | undefined,
	enterAnchoredFollowing: () => void,
	scrollToBottomAuto: () => void,
	transitionScrollPhase: (nextPhase: ScrollPhase) => void,
	cancelReanchorFrame: () => void,
	scrollToBottomSmooth: { clear: () => void },
	isAtBottomRef: React.MutableRefObject<boolean>,
	scrollPhaseRef: React.MutableRefObject<ScrollPhase>,
	setShowScrollToBottom: React.Dispatch<React.SetStateAction<boolean>>,
) {
	const isMountedRef = useRef(true)
	const isHydratingRef = useRef(false)
	const hydrationTimeoutRef = useRef<number | null>(null)
	const hydrationRetryUsedRef = useRef(false)

	const clearHydrationWindow = useCallback(() => {
		isHydratingRef.current = false
		hydrationRetryUsedRef.current = false
		if (hydrationTimeoutRef.current !== null) {
			window.clearTimeout(hydrationTimeoutRef.current)
			hydrationTimeoutRef.current = null
		}
	}, [])

	const finishHydrationWindow = useCallback(() => {
		if (!isMountedRef.current || !isHydratingRef.current) return
		if (scrollPhaseRef.current === "HYDRATING_PINNED_TO_BOTTOM") {
			if (isAtBottomRef.current) {
				enterAnchoredFollowing()
			} else if (!hydrationRetryUsedRef.current) {
				hydrationRetryUsedRef.current = true
				scrollToBottomAuto()
				hydrationTimeoutRef.current = window.setTimeout(
					() => finishHydrationWindow(),
					HYDRATION_RETRY_WINDOW_MS,
				)
				return
			} else {
				enterAnchoredFollowing()
			}
		}
		clearHydrationWindow()
	}, [clearHydrationWindow, enterAnchoredFollowing, isAtBottomRef, scrollPhaseRef, scrollToBottomAuto])

	const startHydrationWindow = useCallback(() => {
		isHydratingRef.current = true
		hydrationRetryUsedRef.current = false
		if (hydrationTimeoutRef.current !== null) window.clearTimeout(hydrationTimeoutRef.current)
		hydrationTimeoutRef.current = window.setTimeout(() => finishHydrationWindow(), HYDRATION_WINDOW_MS)
		scrollToBottomAuto()
	}, [finishHydrationWindow, scrollToBottomAuto])

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
			clearHydrationWindow()
			cancelReanchorFrame()
			scrollToBottomSmooth.clear()
		}
	}, [cancelReanchorFrame, clearHydrationWindow, scrollToBottomSmooth])

	useEffect(() => {
		isAtBottomRef.current = false
		clearHydrationWindow()
		cancelReanchorFrame()
		if (taskTs) {
			transitionScrollPhase("HYDRATING_PINNED_TO_BOTTOM")
			setShowScrollToBottom(false)
			startHydrationWindow()
		} else {
			transitionScrollPhase("USER_BROWSING_HISTORY")
			setShowScrollToBottom(false)
		}
		return () => {
			clearHydrationWindow()
			cancelReanchorFrame()
		}
	}, [
		cancelReanchorFrame,
		clearHydrationWindow,
		isAtBottomRef,
		setShowScrollToBottom,
		startHydrationWindow,
		taskTs,
		transitionScrollPhase,
	])

	return { isHydratingRef, isMountedRef }
}
