import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import debounce from "debounce"

import type {
	ScrollPhase,
	ScrollFollowDisengageSource,
	UseScrollLifecycleOptions,
	UseScrollLifecycleReturn,
} from "./useScrollLifecycle-helpers"
import { handleAtBottom } from "./useScrollLifecycle-helpers"
import { useScrollLifecycleEventHandlers } from "./useScrollLifecycle-event-handlers"
import { useScrollLifecycleHydration } from "./useScrollLifecycle-hydration"

export function useScrollLifecycle({
	virtuosoRef,
	scrollContainerRef,
	taskTs,
	isStreaming,
	isHidden,
	hasTask,
}: UseScrollLifecycleOptions): UseScrollLifecycleReturn {
	const [scrollPhase, setScrollPhase] = useState<ScrollPhase>("USER_BROWSING_HISTORY")
	const scrollPhaseRef = useRef<ScrollPhase>("USER_BROWSING_HISTORY")
	const [showScrollToBottom, setShowScrollToBottom] = useState(false)
	const isAtBottomRef = useRef(false)
	const reanchorAnimationFrameRef = useRef<number | null>(null)

	const transitionScrollPhase = useCallback((nextPhase: ScrollPhase) => {
		if (scrollPhaseRef.current !== nextPhase) {
			scrollPhaseRef.current = nextPhase
			setScrollPhase(nextPhase)
		}
	}, [])

	const enterAnchoredFollowing = useCallback(() => {
		transitionScrollPhase("ANCHORED_FOLLOWING")
		setShowScrollToBottom(false)
	}, [transitionScrollPhase])

	const enterUserBrowsingHistory = useCallback(
		(_source: ScrollFollowDisengageSource) => {
			transitionScrollPhase("USER_BROWSING_HISTORY")
			setShowScrollToBottom(true)
		},
		[transitionScrollPhase],
	)

	const cancelReanchorFrame = useCallback(() => {
		if (reanchorAnimationFrameRef.current !== null) {
			cancelAnimationFrame(reanchorAnimationFrameRef.current)
			reanchorAnimationFrameRef.current = null
		}
	}, [])

	const scrollToBottomSmooth = useMemo(
		() =>
			debounce(
				() => virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "smooth" }),
				10,
				{ immediate: true },
			),
		[virtuosoRef],
	)

	const scrollToBottomAuto = useCallback(() => {
		virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "auto" })
	}, [virtuosoRef])

	const { isHydratingRef } = useScrollLifecycleHydration(
		taskTs,
		enterAnchoredFollowing,
		scrollToBottomAuto,
		transitionScrollPhase,
		cancelReanchorFrame,
		scrollToBottomSmooth,
		isAtBottomRef,
		scrollPhaseRef,
		setShowScrollToBottom,
	)

	useEffect(() => {
		scrollPhaseRef.current = scrollPhase
	}, [scrollPhase])

	const handleRowHeightChange = useCallback(
		(isTaller: boolean) => {
			if (
				scrollPhaseRef.current === "USER_BROWSING_HISTORY" ||
				scrollPhaseRef.current === "HYDRATING_PINNED_TO_BOTTOM"
			)
				return
			const shouldForcePin = scrollPhaseRef.current === "ANCHORED_FOLLOWING" && isStreaming
			if (isAtBottomRef.current || shouldForcePin) {
				if (isTaller) scrollToBottomSmooth()
				else scrollToBottomAuto()
			}
		},
		[isStreaming, scrollToBottomSmooth, scrollToBottomAuto],
	)

	const handleScrollToBottomClick = useCallback(() => {
		enterAnchoredFollowing()
		scrollToBottomAuto()
		cancelReanchorFrame()
		reanchorAnimationFrameRef.current = requestAnimationFrame(() => {
			reanchorAnimationFrameRef.current = null
			if (scrollPhaseRef.current === "ANCHORED_FOLLOWING") scrollToBottomAuto()
		})
	}, [cancelReanchorFrame, enterAnchoredFollowing, scrollToBottomAuto])

	const followOutputCallback = useCallback(
		(): "auto" | false => (scrollPhase === "USER_BROWSING_HISTORY" ? false : "auto"),
		[scrollPhase],
	)

	const { pointerScrollActiveRef } = useScrollLifecycleEventHandlers(
		scrollContainerRef,
		hasTask,
		isHidden,
		enterUserBrowsingHistory,
	)

	const atBottomStateChangeCallback = useCallback(
		(isAtBottom: boolean) => {
			isAtBottomRef.current = isAtBottom
			const currentPhase = scrollPhaseRef.current
			const isHydrating = isHydratingRef.current
			if (!isAtBottom && isHydrating && currentPhase !== "USER_BROWSING_HISTORY") {
				setShowScrollToBottom(false)
				return
			}
			const action = handleAtBottom(isAtBottom, currentPhase, isHydrating)
			if (action === "show") {
				setShowScrollToBottom(true)
				return
			}
			if (action === "follow") {
				enterAnchoredFollowing()
				return
			}
			if (currentPhase === "ANCHORED_FOLLOWING" && pointerScrollActiveRef.current) {
				enterUserBrowsingHistory("pointer-scroll-up")
				return
			}
			if (currentPhase === "ANCHORED_FOLLOWING" && isStreaming) {
				scrollToBottomAuto()
				setShowScrollToBottom(false)
				return
			}
			setShowScrollToBottom(currentPhase === "USER_BROWSING_HISTORY")
		},
		[
			enterAnchoredFollowing,
			enterUserBrowsingHistory,
			isHydratingRef,
			isStreaming,
			pointerScrollActiveRef,
			scrollToBottomAuto,
		],
	)

	return {
		scrollPhase,
		showScrollToBottom,
		handleRowHeightChange,
		handleScrollToBottomClick,
		enterUserBrowsingHistory,
		followOutputCallback,
		atBottomStateChangeCallback,
		scrollToBottomAuto,
		isAtBottomRef,
		scrollPhaseRef,
	}
}
