import { DOMElement, measureElement } from "ink"
import { useEffect } from "react"
import type { ScrollAreaAction, ScrollAreaState } from "./scrollAreaHelpers.js"

export function useScrollAreaEffects(
	height: number,
	heightProp: number | undefined,
	dispatch: React.Dispatch<ScrollAreaAction>,
	outerRef: React.RefObject<DOMElement>,
	measuredHeight: number,
	setMeasuredHeight: (h: number) => void,
	scrollToBottomTrigger: number | undefined,
	scrollToLine: number | undefined,
	scrollToLineTrigger: number | undefined,
	innerRef: React.RefObject<DOMElement>,
	lastMeasuredHeight: React.MutableRefObject<number>,
	prevScrollToLineTriggerRef: React.MutableRefObject<number | undefined>,
	children: React.ReactNode,
	onScroll: ((scrollTop: number, maxScroll: number, isAtBottom: boolean) => void) | undefined,
	state: ScrollAreaState,
) {
	useEffect(() => {
		if (height > 0) dispatch({ type: "SET_HEIGHT", height })
	}, [height])
	useEffect(() => {
		if (heightProp !== undefined) return
		const measureOuter = () => {
			if (outerRef.current) {
				const d = measureElement(outerRef.current)
				if (d.height !== measuredHeight && d.height > 0) setMeasuredHeight(d.height)
			}
		}
		measureOuter()
		const interval = setInterval(measureOuter, 100)
		return () => {
			clearInterval(interval)
		}
	}, [heightProp, measuredHeight])
	useEffect(() => {
		if (scrollToBottomTrigger !== undefined && scrollToBottomTrigger > 0) dispatch({ type: "SCROLL_TO_BOTTOM" })
	}, [scrollToBottomTrigger])
	useEffect(() => {
		const prevTrigger = prevScrollToLineTriggerRef.current
		if (scrollToLineTrigger !== prevTrigger && scrollToLineTrigger !== undefined && scrollToLine !== undefined)
			dispatch({ type: "SCROLL_TO_LINE", line: scrollToLine })
		prevScrollToLineTriggerRef.current = scrollToLineTrigger
	}, [scrollToLineTrigger, scrollToLine])
	useEffect(() => {
		if (!innerRef.current) return
		const measureAndUpdate = () => {
			if (innerRef.current) {
				const d = measureElement(innerRef.current)
				if (d.height !== lastMeasuredHeight.current) {
					lastMeasuredHeight.current = d.height
					dispatch({ type: "SET_INNER_HEIGHT", innerHeight: d.height })
				}
			}
		}
		measureAndUpdate()
		const interval = setInterval(measureAndUpdate, 100)
		return () => {
			clearInterval(interval)
		}
	}, [children])
	useEffect(() => {
		if (onScroll) {
			const maxScroll = Math.max(0, state.innerHeight - state.height)
			onScroll(state.scrollTop, maxScroll, state.scrollTop >= maxScroll || maxScroll === 0)
		}
	}, [state.scrollTop, state.innerHeight, state.height, onScroll])
}
