import React, { memo, useEffect, useRef } from "react"
import { useSize } from "react-use"
import deepEqual from "fast-deep-equal"
import type { Notification, SuggestionItem } from "@jabberwock/types"
import { ChatRowContent } from "./content"

export interface ChatRowProps {
	message: Notification
	lastModifiedMessage?: Notification
	isLast: boolean
	onHeightChange: (isTaller: boolean) => void
	onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	isNested?: boolean
	history?: Notification[]
}

const ChatRow = memo((props: ChatRowProps) => {
	const { isLast, onHeightChange, message } = props
	const prevHeightRef = useRef(0)
	const [chatrow, { height }] = useSize(
		<div className="px-[15px] py-[10px] pr-[6px]">
			<ChatRowContent {...props} />
		</div>,
	)
	useEffect(() => {
		const isHeightValid = height !== 0 && height !== Infinity
		const isInitialRender = prevHeightRef.current === 0
		if (isLast && isHeightValid && height !== prevHeightRef.current) {
			if (!isInitialRender) onHeightChange(height > prevHeightRef.current)
			prevHeightRef.current = height
		}
	}, [height, isLast, onHeightChange, message])
	return chatrow
}, deepEqual)

export default ChatRow
