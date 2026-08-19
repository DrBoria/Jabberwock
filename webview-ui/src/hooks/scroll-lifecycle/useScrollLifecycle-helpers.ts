import React from "react"
import type { VirtuosoHandle } from "react-virtuoso"

export type ScrollPhase = "HYDRATING_PINNED_TO_BOTTOM" | "ANCHORED_FOLLOWING" | "USER_BROWSING_HISTORY"
export type ScrollFollowDisengageSource = "wheel-up" | "row-expansion" | "keyboard-nav-up" | "pointer-scroll-up"

export const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
	if (!(target instanceof HTMLElement)) return false
	if (target.isContentEditable) return true
	const tagName = target.tagName
	return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT"
}

export const isModifierKey = (event: KeyboardEvent): boolean => event.metaKey || event.ctrlKey || event.altKey

export const isScrollUpKey = (key: string): boolean => key === "PageUp" || key === "Home" || key === "ArrowUp"

export const isTargetInChat = (
	activeElement: Element | null,
	keyEvent: KeyboardEvent,
	scrollContainer: HTMLElement | null,
): boolean => {
	const focusInsideChat = activeElement instanceof HTMLElement && !!scrollContainer?.contains(activeElement)
	const eventTargetInsideChat = keyEvent.target instanceof Node && !!scrollContainer?.contains(keyEvent.target)
	return focusInsideChat || eventTargetInsideChat || activeElement === document.body
}

export const handleAtBottom = (
	isAtBottom: boolean,
	currentPhase: ScrollPhase,
	isHydrating: boolean,
): "show" | "follow" | null =>
	!isAtBottom ? null : currentPhase === "USER_BROWSING_HISTORY" && isHydrating ? "show" : "follow"

export interface UseScrollLifecycleOptions {
	virtuosoRef: React.RefObject<VirtuosoHandle | null>
	scrollContainerRef: React.RefObject<HTMLDivElement | null>
	taskTs: number | undefined
	isStreaming: boolean
	isHidden: boolean
	hasTask: boolean
}

export interface UseScrollLifecycleReturn {
	scrollPhase: ScrollPhase
	showScrollToBottom: boolean
	handleRowHeightChange: (isTaller: boolean) => void
	handleScrollToBottomClick: () => void
	enterUserBrowsingHistory: (source: ScrollFollowDisengageSource) => void
	followOutputCallback: () => "auto" | false
	atBottomStateChangeCallback: (isAtBottom: boolean) => void
	scrollToBottomAuto: () => void
	isAtBottomRef: React.MutableRefObject<boolean>
	scrollPhaseRef: React.MutableRefObject<ScrollPhase>
}
