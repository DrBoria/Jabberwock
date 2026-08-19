export interface ScrollAreaState {
	innerHeight: number
	height: number
	scrollTop: number
	autoScroll: boolean
}

export function calculateScrollbar(
	viewportHeight: number,
	contentHeight: number,
	scrollTop: number,
): { handleStart: number; handleHeight: number; maxScroll: number } {
	const maxScroll = Math.max(0, contentHeight - viewportHeight)
	if (contentHeight <= viewportHeight || maxScroll === 0)
		return { handleStart: 0, handleHeight: viewportHeight, maxScroll: 0 }
	const handleHeight = Math.max(1, Math.round((viewportHeight / contentHeight) * viewportHeight))
	const trackSpace = viewportHeight - handleHeight
	const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0
	return { handleStart: Math.round(scrollRatio * trackSpace), handleHeight, maxScroll }
}

export type ScrollAreaAction =
	| { type: "SET_INNER_HEIGHT"; innerHeight: number }
	| { type: "SET_HEIGHT"; height: number }
	| { type: "SCROLL_DOWN"; amount?: number }
	| { type: "SCROLL_UP"; amount?: number }
	| { type: "SCROLL_TO_BOTTOM" }
	| { type: "SCROLL_TO_LINE"; line: number }
	| { type: "SET_AUTO_SCROLL"; autoScroll: boolean }

function handleSetInnerHeight(state: ScrollAreaState, innerHeight: number): ScrollAreaState {
	const newMaxScroll = Math.max(0, innerHeight - state.height)
	if (state.autoScroll && innerHeight > state.innerHeight) return { ...state, innerHeight, scrollTop: newMaxScroll }
	return { ...state, innerHeight, scrollTop: Math.min(state.scrollTop, newMaxScroll) }
}

function handleSetHeight(state: ScrollAreaState, height: number): ScrollAreaState {
	const newMaxScroll = Math.max(0, state.innerHeight - height)
	if (state.autoScroll) return { ...state, height, scrollTop: newMaxScroll }
	return { ...state, height, scrollTop: Math.min(state.scrollTop, newMaxScroll) }
}

function handleScrollDown(state: ScrollAreaState, amount: number = 1): ScrollAreaState {
	const maxScroll = Math.max(0, state.innerHeight - state.height)
	const newScrollTop = Math.min(maxScroll, state.scrollTop + amount)
	return { ...state, scrollTop: newScrollTop, autoScroll: newScrollTop >= maxScroll }
}

function handleScrollUp(state: ScrollAreaState, amount: number = 1): ScrollAreaState {
	const maxScroll = Math.max(0, state.innerHeight - state.height)
	const newScrollTop = Math.max(0, state.scrollTop - amount)
	return { ...state, scrollTop: newScrollTop, autoScroll: newScrollTop >= maxScroll }
}

function handleScrollToLine(state: ScrollAreaState, line: number): ScrollAreaState {
	const maxScroll = Math.max(0, state.innerHeight - state.height)
	const viewportBottom = state.scrollTop + state.height - 1
	if (line < state.scrollTop) return { ...state, scrollTop: Math.max(0, line), autoScroll: false }
	if (line > viewportBottom)
		return { ...state, scrollTop: Math.min(maxScroll, line - state.height + 1), autoScroll: true }
	return state
}

export function scrollAreaReducer(state: ScrollAreaState, action: ScrollAreaAction): ScrollAreaState {
	switch (action.type) {
		case "SET_INNER_HEIGHT":
			return handleSetInnerHeight(state, action.innerHeight)
		case "SET_HEIGHT":
			return handleSetHeight(state, action.height)
		case "SCROLL_DOWN":
			return handleScrollDown(state, action.amount)
		case "SCROLL_UP":
			return handleScrollUp(state, action.amount)
		case "SCROLL_TO_BOTTOM": {
			const maxScroll = Math.max(0, state.innerHeight - state.height)
			return { ...state, scrollTop: maxScroll, autoScroll: true }
		}
		case "SCROLL_TO_LINE":
			return handleScrollToLine(state, action.line)
		case "SET_AUTO_SCROLL": {
			const maxScroll = Math.max(0, state.innerHeight - state.height)
			return {
				...state,
				autoScroll: action.autoScroll,
				scrollTop: action.autoScroll ? maxScroll : state.scrollTop,
			}
		}
		default:
			return state
	}
}

export function handleScrollKeyInput(
	input: string,
	key: Record<string, boolean>,
	isActive: boolean,
	state: ScrollAreaState,
	dispatch: React.Dispatch<ScrollAreaAction>,
) {
	if (!isActive) return
	if (key.downArrow) dispatch({ type: "SCROLL_DOWN" })
	if (key.upArrow) dispatch({ type: "SCROLL_UP" })
	if (key.pageDown) dispatch({ type: "SCROLL_DOWN", amount: Math.floor(state.height / 2) })
	if (key.pageUp) dispatch({ type: "SCROLL_UP", amount: Math.floor(state.height / 2) })
	if (key.ctrl && input === "a") dispatch({ type: "SCROLL_UP", amount: state.scrollTop })
	if (key.ctrl && input === "e") dispatch({ type: "SCROLL_TO_BOTTOM" })
}
