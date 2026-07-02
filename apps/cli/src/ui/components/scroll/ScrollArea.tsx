import { Box, DOMElement, useInput } from "ink"
import { useReducer, useRef, useCallback, useMemo, useState } from "react"
import {
	type ScrollAreaState,
	calculateScrollbar,
	scrollAreaReducer,
	handleScrollKeyInput,
} from "./scrollAreaHelpers.js"
import { Scrollbar } from "./Scrollbar.js"
import { useScrollAreaEffects } from "./useScrollAreaEffects.js"

export interface ScrollAreaProps {
	height?: number
	children: React.ReactNode
	isActive?: boolean
	onScroll?: (scrollTop: number, maxScroll: number, isAtBottom: boolean) => void
	showBorder?: boolean
	scrollToBottomTrigger?: number
	scrollToLine?: number
	scrollToLineTrigger?: number
	showScrollbar?: boolean
	autoScroll?: boolean
}

function ScrollAreaRender({
	height,
	useFlexGrow,
	outerRef,
	showBorder,
	showScrollbar,
	scrollbar,
	isActive,
	innerRef,
	children,
	state,
}: {
	height: number
	useFlexGrow: boolean
	outerRef: React.RefObject<DOMElement>
	showBorder: boolean
	showScrollbar: boolean
	scrollbar: ReturnType<typeof calculateScrollbar>
	isActive: boolean
	innerRef: React.RefObject<DOMElement>
	children: React.ReactNode
	state: ScrollAreaState
}) {
	return (
		<Box
			ref={outerRef}
			flexDirection="row"
			height={useFlexGrow ? undefined : height}
			flexGrow={useFlexGrow ? 1 : undefined}
			flexShrink={useFlexGrow ? 1 : undefined}
			overflow="hidden">
			<Box
				height={useFlexGrow ? undefined : height}
				borderStyle={showBorder ? "single" : undefined}
				flexDirection="column"
				flexGrow={1}
				flexShrink={1}
				overflow="hidden">
				<Box ref={innerRef} flexShrink={0} flexDirection="column" marginTop={-state.scrollTop}>
					{children}
				</Box>
			</Box>
			{showScrollbar && <Scrollbar height={height} scrollbar={scrollbar} isActive={isActive} />}
		</Box>
	)
}

export function ScrollArea({
	height: heightProp,
	children,
	isActive = true,
	onScroll,
	showBorder = false,
	scrollToBottomTrigger,
	scrollToLine,
	scrollToLineTrigger,
	showScrollbar = true,
	autoScroll: autoScrollProp = true,
}: ScrollAreaProps) {
	const outerRef = useRef<DOMElement>(null)
	const [measuredHeight, setMeasuredHeight] = useState(0)
	const height = heightProp ?? measuredHeight
	const [state, dispatch] = useReducer(scrollAreaReducer, {
		height,
		scrollTop: 0,
		innerHeight: 0,
		autoScroll: autoScrollProp,
	})
	const innerRef = useRef<DOMElement>(null)
	const lastMeasuredHeight = useRef<number>(0)
	const prevScrollToLineTriggerRef = useRef<number | undefined>(undefined)
	useScrollAreaEffects(
		height,
		heightProp,
		dispatch,
		outerRef,
		measuredHeight,
		setMeasuredHeight,
		scrollToBottomTrigger,
		scrollToLine,
		scrollToLineTrigger,
		innerRef,
		lastMeasuredHeight,
		prevScrollToLineTriggerRef,
		children,
		onScroll,
		state,
	)
	useInput((input, key) => handleScrollKeyInput(input, key, isActive, state, dispatch), { isActive })
	const scrollbar = useMemo(
		() => calculateScrollbar(state.height, state.innerHeight, state.scrollTop),
		[state.height, state.innerHeight, state.scrollTop],
	)
	const useFlexGrow = heightProp === undefined
	return (
		<ScrollAreaRender
			height={height}
			useFlexGrow={useFlexGrow}
			outerRef={outerRef}
			showBorder={showBorder}
			showScrollbar={showScrollbar}
			scrollbar={scrollbar}
			isActive={isActive}
			innerRef={innerRef}
			state={state}>
			{children}
		</ScrollAreaRender>
	)
}

export function useScrollToBottom() {
	const triggerRef = useRef(0)
	const [, forceUpdate] = useReducer((x) => x + 1, 0)
	const scrollToBottom = useCallback(() => {
		triggerRef.current += 1
		forceUpdate()
	}, [])
	return { scrollToBottomTrigger: triggerRef.current, scrollToBottom }
}
