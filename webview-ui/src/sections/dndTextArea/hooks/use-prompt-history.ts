import { Notification, HistoryItem } from "@jabberwock/types"
import { useCallback, useEffect, useMemo, useState } from "react"

interface UsePromptHistoryProps {
	messages: Notification[] | undefined
	taskHistory: HistoryItem[] | undefined
	cwd: string | undefined
	inputValue: string
	setInputValue: (value: string) => void
}

export interface UsePromptHistoryReturn {
	historyIndex: number
	setHistoryIndex: (index: number) => void
	tempInput: string
	setTempInput: (input: string) => void
	promptHistory: string[]
	handleHistoryNavigation: (
		event: React.KeyboardEvent<HTMLTextAreaElement>,
		showContextMenu: boolean,
		isComposing: boolean,
	) => boolean
	resetHistoryNavigation: () => void
	resetOnInputChange: () => void
}

function handleUpArrow(
	event: React.KeyboardEvent<HTMLTextAreaElement>,
	historyIndex: number,
	isAtBeginning: boolean,
	textarea: HTMLTextAreaElement,
	setTempInput: (input: string) => void,
	inputValue: string,
	navigateToHistory: (index: number, textarea: HTMLTextAreaElement, cursorPos: "start" | "end") => boolean,
): boolean {
	if (!(event.key === "ArrowUp" && isAtBeginning)) {
		return false
	}
	event.preventDefault()
	if (historyIndex === -1) {
		setTempInput(inputValue)
	}
	return navigateToHistory(historyIndex + 1, textarea, "start")
}

function handleDownArrow(
	event: React.KeyboardEvent<HTMLTextAreaElement>,
	historyIndex: number,
	isAtBeginning: boolean,
	isAtEnd: boolean,
	textarea: HTMLTextAreaElement,
	navigateToHistory: (index: number, textarea: HTMLTextAreaElement, cursorPos: "start" | "end") => boolean,
	returnToCurrentInput: (textarea: HTMLTextAreaElement, cursorPos: "start" | "end") => void,
): boolean {
	if (!(event.key === "ArrowDown" && historyIndex >= 0 && (isAtBeginning || isAtEnd))) {
		return false
	}
	event.preventDefault()
	if (historyIndex > 0) {
		return navigateToHistory(historyIndex - 1, textarea, isAtBeginning ? "start" : "end")
	}
	returnToCurrentInput(textarea, isAtBeginning ? "start" : "end")
	return true
}

export const usePromptHistory = ({
	messages,
	taskHistory,
	cwd,
	inputValue,
	setInputValue,
}: UsePromptHistoryProps): UsePromptHistoryReturn => {
	// Maximum number of prompts to keep in history for memory management
	const MAX_PROMPT_HISTORY_SIZE = 100

	// Prompt history navigation state
	const [historyIndex, setHistoryIndex] = useState(-1)
	const [tempInput, setTempInput] = useState("")
	const [promptHistory, setPromptHistory] = useState<string[]>([])

	// Initialize prompt history with hybrid approach: conversation messages if in task, otherwise task history
	const filteredPromptHistory = useMemo(() => {
		// First try to get conversation messages (user_feedback from messages)
		const conversationPrompts = messages
			?.filter((message) => message.type === "say" && message.say === "user_feedback" && message.text?.trim())
			.map((message) => message.text!)

		// If we have conversation messages, use those (newest first when navigating up)
		if (conversationPrompts?.length) {
			return conversationPrompts.slice(-MAX_PROMPT_HISTORY_SIZE).reverse()
		}

		// If we have messages array (meaning we're in an active task), don't fall back to task history
		// Only use task history when starting fresh (no active conversation)
		if (messages?.length) {
			return []
		}

		// Fall back to task history only when starting fresh (no active conversation)
		if (!taskHistory?.length || !cwd) {
			return []
		}

		// Extract user prompts from task history for the current workspace only
		return taskHistory
			.filter((item) => item.task?.trim() && (!item.workspace || item.workspace === cwd))
			.map((item) => item.task)
			.slice(0, MAX_PROMPT_HISTORY_SIZE)
	}, [messages, taskHistory, cwd])

	// Update prompt history when filtered history changes and reset navigation
	useEffect(() => {
		setPromptHistory(filteredPromptHistory)
		// Reset navigation state when switching between history sources
		setHistoryIndex(-1)
		setTempInput("")
	}, [filteredPromptHistory])

	// Reset history navigation when user types (but not when we're setting it programmatically)
	const resetOnInputChange = useCallback(() => {
		if (historyIndex !== -1) {
			setHistoryIndex(-1)
			setTempInput("")
		}
	}, [historyIndex])

	// Helper to set cursor position after React renders
	const setCursorPosition = useCallback(
		(textarea: HTMLTextAreaElement, position: number | "start" | "end", length?: number) => {
			setTimeout(() => {
				if (position === "start") {
					textarea.setSelectionRange(0, 0)
				} else if (position === "end") {
					const len = length ?? textarea.value.length
					textarea.setSelectionRange(len, len)
				} else {
					textarea.setSelectionRange(position, position)
				}
			}, 0)
		},
		[],
	)

	// Helper to navigate to a specific history entry
	const navigateToHistory = useCallback(
		(newIndex: number, textarea: HTMLTextAreaElement, cursorPos: "start" | "end" = "start"): boolean => {
			if (newIndex < 0 || newIndex >= promptHistory.length) return false

			const historicalPrompt = promptHistory[newIndex]
			if (!historicalPrompt) return false

			setHistoryIndex(newIndex)
			setInputValue(historicalPrompt)
			setCursorPosition(textarea, cursorPos, historicalPrompt.length)

			return true
		},
		[promptHistory, setInputValue, setCursorPosition],
	)

	// Helper to return to current input
	const returnToCurrentInput = useCallback(
		(textarea: HTMLTextAreaElement, cursorPos: "start" | "end" = "end") => {
			setHistoryIndex(-1)
			setInputValue(tempInput)
			setCursorPosition(textarea, cursorPos, tempInput.length)
		},
		[tempInput, setInputValue, setCursorPosition],
	)

	const handleHistoryNavigation = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>, showContextMenu: boolean, isComposing: boolean): boolean => {
			if (!showContextMenu && promptHistory.length > 0 && !isComposing) {
				const textarea = event.currentTarget
				const { selectionStart, selectionEnd, value } = textarea
				const hasSelection = selectionStart !== selectionEnd
				const isAtBeginning = selectionStart === 0 && selectionEnd === 0
				const isAtEnd = selectionStart === value.length && selectionEnd === value.length

				if (!hasSelection) {
					if (
						handleUpArrow(
							event,
							historyIndex,
							isAtBeginning,
							textarea,
							setTempInput,
							inputValue,
							navigateToHistory,
						)
					) {
						return true
					}

					if (
						handleDownArrow(
							event,
							historyIndex,
							isAtBeginning,
							isAtEnd,
							textarea,
							navigateToHistory,
							returnToCurrentInput,
						)
					) {
						return true
					}
				}
			}
			return false
		},
		[promptHistory, historyIndex, inputValue, navigateToHistory, returnToCurrentInput, setTempInput],
	)

	const resetHistoryNavigation = useCallback(() => {
		setHistoryIndex(-1)
		setTempInput("")
	}, [])

	return {
		historyIndex,
		setHistoryIndex,
		tempInput,
		setTempInput,
		promptHistory,
		handleHistoryNavigation,
		resetHistoryNavigation,
		resetOnInputChange,
	}
}
