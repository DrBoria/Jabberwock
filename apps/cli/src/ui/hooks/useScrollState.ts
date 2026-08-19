import { useState, useRef, useCallback, useEffect } from "react"

import { useScrollToBottom } from "../components/scroll/ScrollArea.js"

interface ScrollState {
	scrollTop: number
	maxScroll: number
	isAtBottom: boolean
}

export function useScrollState(messagesLength: number) {
	const [scrollState, setScrollState] = useState<ScrollState>({ scrollTop: 0, maxScroll: 0, isAtBottom: true })
	const { scrollToBottomTrigger, scrollToBottom } = useScrollToBottom()
	const rafIdRef = useRef<NodeJS.Immediate | null>(null)
	const pendingScrollRef = useRef<ScrollState | null>(null)
	const prevMessageCount = useRef(messagesLength)

	useEffect(() => {
		if (messagesLength > prevMessageCount.current && scrollState.isAtBottom) {
			scrollToBottom()
		}
		prevMessageCount.current = messagesLength
	}, [messagesLength, scrollState.isAtBottom, scrollToBottom])

	const handleScroll = useCallback((scrollTop: number, maxScroll: number, isAtBottom: boolean) => {
		pendingScrollRef.current = { scrollTop, maxScroll, isAtBottom }
		if (rafIdRef.current === null) {
			rafIdRef.current = setImmediate(() => {
				rafIdRef.current = null
				const pending = pendingScrollRef.current
				if (pending) {
					setScrollState(pending)
					pendingScrollRef.current = null
				}
			})
		}
	}, [])

	useEffect(
		() => () => {
			if (rafIdRef.current !== null) clearImmediate(rafIdRef.current)
		},
		[],
	)

	return { scrollState, scrollToBottomTrigger, handleScroll }
}
