import React, { useCallback, useRef } from "react"
import { useEvent } from "react-use"

import type { ScrollFollowDisengageSource } from "./useScrollLifecycle-helpers"
import { isEditableKeyboardTarget, isModifierKey, isScrollUpKey, isTargetInChat } from "./useScrollLifecycle-helpers"

export function useScrollLifecycleEventHandlers(
	scrollContainerRef: React.RefObject<HTMLDivElement | null>,
	hasTask: boolean,
	isHidden: boolean,
	enterUserBrowsingHistory: (source: ScrollFollowDisengageSource) => void,
) {
	const pointerScrollActiveRef = useRef(false)
	const pointerScrollElementRef = useRef<HTMLElement | null>(null)
	const pointerScrollLastTopRef = useRef<number | null>(null)

	const handleWheel = useCallback(
		(event: Event) => {
			const w = event as WheelEvent
			if (w.deltaY < 0 && scrollContainerRef.current?.contains(w.target as Node))
				enterUserBrowsingHistory("wheel-up")
		},
		[enterUserBrowsingHistory, scrollContainerRef],
	)
	useEvent("wheel", handleWheel, window, { passive: true })

	const handlePointerDown = useCallback(
		(event: Event) => {
			const pointerEvent = event as PointerEvent
			const pointerTarget = pointerEvent.target
			if (!(pointerTarget instanceof HTMLElement) || !scrollContainerRef.current?.contains(pointerTarget)) {
				pointerScrollActiveRef.current = false
				pointerScrollElementRef.current = null
				pointerScrollLastTopRef.current = null
				return
			}
			const scroller =
				(pointerTarget.closest(".scrollable") as HTMLElement | null) ??
				(pointerTarget.scrollHeight > pointerTarget.clientHeight ? pointerTarget : null)
			pointerScrollActiveRef.current = scroller !== null
			pointerScrollElementRef.current = scroller
			pointerScrollLastTopRef.current = scroller?.scrollTop ?? null
		},
		[scrollContainerRef],
	)

	const handlePointerEnd = useCallback(() => {
		pointerScrollActiveRef.current = false
		pointerScrollElementRef.current = null
		pointerScrollLastTopRef.current = null
	}, [])

	const handlePointerActiveScroll = useCallback(
		(event: Event) => {
			if (!pointerScrollActiveRef.current) return
			const scrollTarget = event.target
			if (
				!(scrollTarget instanceof HTMLElement) ||
				!scrollContainerRef.current?.contains(scrollTarget) ||
				pointerScrollElementRef.current !== scrollTarget
			)
				return
			const previousTop = pointerScrollLastTopRef.current
			const currentTop = scrollTarget.scrollTop
			pointerScrollLastTopRef.current = currentTop
			if (previousTop !== null && currentTop < previousTop) enterUserBrowsingHistory("pointer-scroll-up")
		},
		[enterUserBrowsingHistory, scrollContainerRef],
	)

	useEvent("pointerdown", handlePointerDown, window, { passive: true })
	useEvent("pointerup", handlePointerEnd, window, { passive: true })
	useEvent("pointercancel", handlePointerEnd, window, { passive: true })
	useEvent("scroll", handlePointerActiveScroll, window, { passive: true, capture: true })

	const handleScrollKeyDown = useCallback(
		(event: Event) => {
			const keyEvent = event as KeyboardEvent
			const scrollContainer = scrollContainerRef.current
			if (
				!hasTask ||
				isHidden ||
				isModifierKey(keyEvent) ||
				!isScrollUpKey(keyEvent.key) ||
				isEditableKeyboardTarget(keyEvent.target)
			)
				return
			if (isTargetInChat(document.activeElement, keyEvent, scrollContainer))
				enterUserBrowsingHistory("keyboard-nav-up")
		},
		[enterUserBrowsingHistory, hasTask, isHidden, scrollContainerRef],
	)
	useEvent("keydown", handleScrollKeyDown, window)

	return { pointerScrollActiveRef }
}
